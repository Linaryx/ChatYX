import { afterEach, describe, expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG, type ChatConfig } from "../src/config/chatUrlParams";
import {
  PreviewRuntime,
  type PreviewRuntimeDependencies,
  type PreviewRuntimeHooks,
} from "../src/features/chat-overlay/application/previewRuntime";

const initialConfig: ChatConfig = { ...DEFAULT_CHAT_CONFIG, rteProxy: true };

const originalWindow = (globalThis as { window?: unknown }).window;
const originalDocument = (globalThis as { document?: unknown }).document;

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as unknown as { window: unknown }).window = originalWindow;
  if (originalDocument === undefined) delete (globalThis as { document?: unknown }).document;
  else (globalThis as unknown as { document: unknown }).document = originalDocument;
});

function createHooks(): PreviewRuntimeHooks {
  return {
    onConfigResolved: () => {},
    onServiceReady: () => {},
    onLoadingChange: () => {},
    onConnectionChange: () => {},
    onMessagesChange: () => {},
    onAnimationDurationChange: () => {},
    onChannelResolved: () => {},
    onLoadingComplete: () => {},
  };
}

function createHarness(hooks: Partial<PreviewRuntimeHooks> = {}) {
  const calls: string[] = [];
  const timeouts: Array<() => void> = [];
  const intervals: Array<{ callback: () => void; delay: number }> = [];
  let nextTimer = 1;

  (globalThis as unknown as { window: unknown }).window = {
    setTimeout: (callback: () => void) => {
      timeouts.push(callback);
      return nextTimer++;
    },
    clearTimeout: (id: number) => calls.push(`clear-timeout:${id}`),
    setInterval: (callback: () => void, delay: number) => {
      intervals.push({ callback, delay });
      return 77;
    },
    clearInterval: (id: number) => calls.push(`clear-interval:${id}`),
    requestAnimationFrame: () => 1,
  };
  (globalThis as unknown as { document: unknown }).document = {
    documentElement: {
      style: { setProperty: () => {}, removeProperty: () => {} },
      setAttribute: () => {},
      removeAttribute: () => {},
    },
    head: { appendChild: () => {} },
    getElementById: () => null,
    createElement: () => ({ id: "", textContent: "", remove: () => {}, style: {} }),
    querySelectorAll: () => [],
  };

  const dependencies: PreviewRuntimeDependencies = {
    createPresentationService: () => ({
      updateConfig: () => {},
      cleanup: () => calls.push("service.cleanup"),
      cancelMessageRemovals: () => calls.push("service.cancel-removals"),
      getConfig: () => ({ animation: { duration: 0 } }),
      scrollToLatest: () => {},
      initializeLayout: () => {},
    }) as never,
    setProxyEnabled: (enabled) => calls.push(`proxy:${enabled}`),
    resolveChannelId: async () => "0",
    fetchChannelUsers: async () => undefined,
    loadEmotes: async () => undefined,
    loadBadges: async () => undefined,
    loadCosmetics: async () => undefined,
    resetSharedAssetState: () => calls.push("reset-shared-state"),
  };

  const runtime = new PreviewRuntime(
    { channel: "chatyxpreview", initialConfig, demoKind: "pasta" },
    { ...createHooks(), ...hooks },
    dependencies,
  );

  /** Runs the render timer that `initialize()` installs. */
  const finishRendering = () => {
    const last = timeouts.at(-1);
    if (!last) throw new Error("the preview runtime installed no render timer");
    timeouts.length = 0;
    last();
  };

  return { runtime, calls, finishRendering, intervals };
}

describe("preview runtime teardown", () => {
  test("debug disconnect stops playback and config changes cannot restart it until reconnect", async () => {
    const connections: boolean[] = [];
    let messageUpdates = 0;
    const { runtime, calls, finishRendering, intervals } = createHarness({
      onConnectionChange: (connected) => connections.push(connected),
      onMessagesChange: () => { messageUpdates += 1; },
    });
    await runtime.initialize();
    finishRendering();
    expect(intervals).toHaveLength(1);
    const updatesBeforeDisconnect = messageUpdates;
    runtime.debugDisconnect();
    runtime.debugDisconnect();
    expect(calls).toContain("clear-interval:77");
    expect(calls).toContain("service.cancel-removals");
    runtime.updateConfig({ ...initialConfig, messageSpeed: 60 });
    intervals[0].callback(); // A stale callback must not append during interruption.
    expect(messageUpdates).toBe(updatesBeforeDisconnect);
    expect(intervals).toHaveLength(1);
    runtime.debugReconnect();
    runtime.debugReconnect();
    expect(intervals).toHaveLength(2);
    expect(intervals[1].delay).toBe(500);
    intervals[1].callback();
    expect(messageUpdates).toBe(updatesBeforeDisconnect + 1);
    expect(connections).toEqual([true, false, true]);
    runtime.destroy();
    runtime.debugReconnect();
    expect(intervals).toHaveLength(2);
  });

  test("destroy releases the document state the runtime claimed", async () => {
    const { runtime, calls, finishRendering } = createHarness();

    await runtime.initialize();
    finishRendering();
    runtime.destroy();

    expect(calls).toContain("proxy:true");
    expect(calls).toContain("proxy:false");
    expect(calls).toContain("reset-shared-state");
    expect(calls).toContain("service.cleanup");
    // The message interval `finishInitialization` started is stopped.
    expect(calls).toContain("clear-interval:77");
    expect(calls.indexOf("proxy:true")).toBeLessThan(calls.indexOf("proxy:false"));
    expect(calls.indexOf("reset-shared-state")).toBeGreaterThan(
      calls.indexOf("service.cleanup"),
    );
  });

  test("destroy before initialize does not release state it never claimed", () => {
    const { runtime, calls } = createHarness();

    runtime.destroy();

    expect(calls).not.toContain("proxy:false");
    expect(calls).not.toContain("reset-shared-state");
    expect(calls).not.toContain("service.cleanup");
  });

  test("a destroyed preview runtime ignores further configuration", async () => {
    const { runtime, calls, finishRendering } = createHarness();

    await runtime.initialize();
    finishRendering();
    runtime.destroy();

    const afterDestroy = calls.length;
    runtime.updateConfig({ ...initialConfig, size: 52 });

    expect(calls).toHaveLength(afterDestroy);
  });

  test("a destroyed preview runtime cannot be initialized again", async () => {
    const { runtime, calls } = createHarness();

    runtime.destroy();
    const afterDestroy = calls.length;
    await runtime.initialize();

    // Destruction is terminal: nothing was claimed again.
    expect(calls).toHaveLength(afterDestroy);
    expect(calls).not.toContain("reset-shared-state");
  });
});
