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

function createHarness() {
  const calls: string[] = [];
  const timeouts: Array<() => void> = [];
  let nextTimer = 1;

  (globalThis as unknown as { window: unknown }).window = {
    setTimeout: (callback: () => void) => {
      timeouts.push(callback);
      return nextTimer++;
    },
    clearTimeout: (id: number) => calls.push(`clear-timeout:${id}`),
    setInterval: () => 77,
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
    createHooks(),
    dependencies,
  );

  /** Runs the render timer that `initialize()` installs. */
  const finishRendering = () => {
    const last = timeouts.at(-1);
    if (!last) throw new Error("the preview runtime installed no render timer");
    timeouts.length = 0;
    last();
  };

  return { runtime, calls, finishRendering };
}

describe("preview runtime teardown", () => {
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
});
