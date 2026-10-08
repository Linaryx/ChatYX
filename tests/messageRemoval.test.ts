import { afterEach, expect, test } from "bun:test";
import { getInheritedRemovalFilter, MessageRemovalManager, REMOVAL_CAPTURE_OPTIONS } from "../src/services/chat/runtime/messageRemoval";
import { MessageFadeManager } from "../src/services/chat/runtime/messageFade";
import { createChatPresentationConfig } from "../src/services/chat/chatPresentationService";
import { DEFAULT_CHAT_CONFIG } from "../src/config/chatUrlParams";

const originalWindow = (globalThis as { window?: unknown }).window;
const originalGetComputedStyle = globalThis.getComputedStyle;

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as unknown as { window: unknown }).window = originalWindow;
  globalThis.getComputedStyle = originalGetComputedStyle;
});

function installAnimationWindow(reducedMotion = false) {
  (globalThis as unknown as { window: unknown }).window = {
    matchMedia: () => ({ matches: reducedMotion }),
  };
  globalThis.getComputedStyle = (() => ({ opacity: "1" })) as unknown as typeof getComputedStyle;
}

test("moderation fade commits only once after playback and ignores duplicate deletions", async () => {
  installAnimationWindow();
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => { finish = resolve; });
  let animations = 0;
  let removed = 0;
  let cancelled = 0;
  const element = {
    isConnected: true,
    animate: () => {
      animations += 1;
      return { finished, cancel: () => { cancelled += 1; } };
    },
  } as unknown as HTMLElement;
  const manager = new MessageRemovalManager();
  manager.remove(element, "fade", () => { removed += 1; });
  manager.remove(element, "fade", () => { removed += 1; });
  expect(removed).toBe(0);
  expect(animations).toBe(1);
  finish();
  await finished;
  await Promise.resolve();
  expect(removed).toBe(1);
  expect(cancelled).toBe(1);
  manager.destroy();
});

test("destroy cancels pending playback without committing stale state updates", async () => {
  installAnimationWindow();
  let reject!: (error: Error) => void;
  const finished = new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; });
  let removed = false;
  const element = {
    isConnected: true,
    animate: () => ({ finished, cancel: () => reject(new Error("cancelled")) }),
  } as unknown as HTMLElement;
  const manager = new MessageRemovalManager();
  manager.remove(element, "fade", () => { removed = true; });
  manager.destroy();
  await finished.catch(() => {});
  await Promise.resolve();
  expect(removed).toBe(false);
});

test("overlapping group removals wait for the active batch instead of deleting immediately", async () => {
  installAnimationWindow();
  let finishFirst!: () => void;
  let finishSecond!: () => void;
  const firstFinished = new Promise<void>((resolve) => { finishFirst = resolve; });
  const secondFinished = new Promise<void>((resolve) => { finishSecond = resolve; });
  let started = 0;
  const row = (finished: Promise<void>) => ({
    isConnected: true,
    animate: () => { started += 1; return { finished, cancel: () => {} }; },
  }) as unknown as HTMLElement;
  const container = {} as HTMLElement;
  const manager = new MessageRemovalManager();
  const commits: string[] = [];
  manager.removeGroup(container, [row(firstFinished)], "fade", () => commits.push("first"));
  manager.removeGroup(container, [row(secondFinished)], "fade", () => commits.push("second"));
  expect(started).toBe(1);
  expect(commits).toEqual([]);
  finishFirst();
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  expect(started).toBe(2);
  expect(commits).toEqual(["first"]);
  finishSecond();
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  expect(commits).toEqual(["first", "second"]);
  manager.destroy();
});

test("cancelAll discards pending and queued removals but permits new playback", async () => {
  installAnimationWindow();
  let rejectFirst!: (reason: Error) => void;
  const firstFinished = new Promise<void>((_resolve, reject) => { rejectFirst = reject; });
  let finishNew!: () => void;
  const newFinished = new Promise<void>((resolve) => { finishNew = resolve; });
  const container = {} as HTMLElement;
  const row = {
    isConnected: true,
    animate: () => ({ finished: firstFinished, cancel: () => rejectFirst(new Error("cancelled")) }),
  } as unknown as HTMLElement;
  const manager = new MessageRemovalManager();
  const commits: string[] = [];
  manager.removeGroup(container, [row], "fade", () => commits.push("old"));
  manager.removeGroup(container, [row], "fade", () => commits.push("queued"));
  manager.cancelAll();
  const newRow = {
    isConnected: true,
    animate: () => ({ finished: newFinished, cancel: () => {} }),
  } as unknown as HTMLElement;
  manager.removeGroup(container, [newRow], "fade", () => commits.push("new"));
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  expect(commits).toEqual([]);
  expect(manager.isRemoving(container)).toBe(true);
  finishNew();
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  expect(commits).toEqual(["new"]);
  manager.destroy();
});

test("particles replace the live content but retain layout until playback finishes", async () => {
  installAnimationWindow();
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => { finish = resolve; });
  let opacity = "0.8";
  let priority = "";
  const element = {
    isConnected: true,
    style: {
      getPropertyValue: () => opacity,
      getPropertyPriority: () => priority,
      setProperty: (_name: string, value: string, nextPriority = "") => {
        opacity = value;
        priority = nextPriority;
      },
      removeProperty: () => { opacity = ""; priority = ""; },
    },
  } as unknown as HTMLElement;
  const manager = new MessageRemovalManager();
  (manager as any).getDisintegrator = async () => ({
    remove: (_element: HTMLElement, options: { detach: () => void }) => {
      expect(opacity).toBe("0.8"); // Snapshot sees the original, visible message.
      options.detach();
      return { finished, cancel: () => {} };
    },
  });
  let removed = false;
  manager.remove(element, "thanos", () => { removed = true; });
  await Promise.resolve();
  expect(opacity).toBe("0");
  expect(priority).toBe("important");
  expect(removed).toBe(false);
  finish();
  await finished;
  await Promise.resolve();
  expect(removed).toBe(true);
  expect(opacity).toBe("0.8");
  expect(priority).toBe("");
  manager.destroy();
});

test("particle overlays preserve ancestor shadows without duplicating the row's own captured filter", () => {
  const outer = { parentElement: null, filter: "drop-shadow(2px 2px 8px rgb(0, 0, 0))" };
  const inner = { parentElement: outer, filter: "none" };
  const element = { parentElement: inner, filter: "blur(1px)" } as unknown as HTMLElement;
  globalThis.getComputedStyle = ((node: { filter: string }) => ({ filter: node.filter })) as unknown as typeof getComputedStyle;
  expect(getInheritedRemovalFilter(element)).toBe("drop-shadow(2px 2px 8px rgb(0, 0, 0))");
});

test("the capture clone freezes CSS playback without replacing paint and modifier styles", () => {
  const styles = new Map([
    ["background-image", "linear-gradient(red, blue)"],
    ["-webkit-text-fill-color", "transparent"],
    ["filter", "drop-shadow(0 2px 4px red)"],
    ["transform", "rotate(30deg)"],
  ]);
  const child = { style: { setProperty: (name: string, value: string) => styles.set(name, value) } };
  const rootStyles = new Map<string, string>();
  const clone = {
    style: { setProperty: (name: string, value: string) => rootStyles.set(name, value) },
    querySelectorAll: () => [child],
  };
  const plugin = REMOVAL_CAPTURE_OPTIONS.plugins?.[0] as { beforeRender: (context: unknown) => void };
  plugin.beforeRender({ clone });
  expect(styles.get("animation")).toBe("none");
  expect(styles.get("transition")).toBe("none");
  expect(rootStyles.get("animation")).toBe("none");
  expect(styles.get("background-image")).toBe("linear-gradient(red, blue)");
  expect(styles.get("-webkit-text-fill-color")).toBe("transparent");
  expect(styles.get("filter")).toBe("drop-shadow(0 2px 4px red)");
  expect(styles.get("transform")).toBe("rotate(30deg)");
});

test("none and reduced motion remove immediately without invoking a renderer", () => {
  for (const reducedMotion of [false, true]) {
    installAnimationWindow(reducedMotion);
    const manager = new MessageRemovalManager();
    let removed = 0;
    manager.remove({} as HTMLElement, reducedMotion ? "thanos" : "none", () => { removed += 1; });
    expect(removed).toBe(1);
    manager.destroy();
  }
});

test("disabling lifetime animation preserves the timeout and removes without an opacity phase", () => {
  const callbacks = new Map<number, () => void>();
  let nextId = 0;
  (globalThis as unknown as { window: unknown }).window = {
    setTimeout: (callback: () => void, delay: number) => {
      expect(delay).toBe(15000);
      callbacks.set(++nextId, callback);
      return nextId;
    },
    clearTimeout: (id: number) => callbacks.delete(id),
  };
  const config = createChatPresentationConfig({ ...DEFAULT_CHAT_CONFIG, fade: 15, fadeAnimation: false });
  expect(config.fade.enabled).toBe(true);
  expect(config.fade.fadeOutDuration).toBe(0);
  const manager = new MessageFadeManager(config.fade);
  const element = { isConnected: true, style: {} } as HTMLElement;
  let removed = false;
  manager.scheduleMessage(element, () => { removed = true; });
  expect(removed).toBe(false);
  callbacks.get(1)?.();
  expect(removed).toBe(true);
  expect(element.style.opacity).toBeUndefined();
  expect(nextId).toBe(1);
  manager.clear();
});

test("canceling an active lifetime fade restores appearance before a moderation capture", () => {
  const timers = new Map<number, () => void>();
  let nextId = 0;
  (globalThis as unknown as { window: unknown }).window = {
    setTimeout: (callback: () => void) => { timers.set(++nextId, callback); return nextId; },
    clearTimeout: (id: number) => timers.delete(id),
  };
  const values = new Map([["opacity", "0.8"], ["transition", "color 200ms ease"]]);
  const style = {
    getPropertyValue: (name: string) => values.get(name) ?? "",
    getPropertyPriority: () => "",
    setProperty: (name: string, value: string) => values.set(name, value),
    removeProperty: (name: string) => values.delete(name),
    get opacity() { return values.get("opacity"); },
    set opacity(value: string | undefined) { values.set("opacity", value ?? ""); },
    get transition() { return values.get("transition"); },
    set transition(value: string | undefined) { values.set("transition", value ?? ""); },
  };
  const element = { isConnected: true, style } as unknown as HTMLElement;
  const manager = new MessageFadeManager({ enabled: true, timeout: 10000, fadeOutDuration: 1000 });
  manager.scheduleMessage(element);
  timers.get(1)?.();
  expect(style.opacity).toBe("0");
  manager.cancelMessage(element);
  expect(style.opacity).toBe("0.8");
  expect(style.transition).toBe("color 200ms ease");
  expect(timers.size).toBe(0);
});
