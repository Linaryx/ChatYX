import { afterEach, describe, expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG, type ChatConfig } from "../src/config/chatUrlParams";
import {
  ChatOverlayApplication,
  type ChatOverlayApplicationDependencies,
  type ChatOverlayApplicationHooks,
} from "../src/features/chat-overlay/application/chatOverlayApplication";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const initialConfig: ChatConfig = { ...DEFAULT_CHAT_CONFIG, channel: "streamer" };

function createHooks(): ChatOverlayApplicationHooks {
  return {
    onConfigResolved: () => {},
    onServiceReady: () => {},
    onLoadingChange: () => {},
    onCommandStatusChange: () => {},
    onConnectionChange: () => {},
    onMessagesChange: () => {},
    onAnimationDurationChange: () => {},
    onChannelResolved: () => {},
    onPredictionChange: () => {},
    onPredictionTimeChange: () => {},
    onLoadingComplete: () => {},
  };
}

/**
 * The application constructs both runtimes in its constructor, so the harness
 * reports what the constructor built separately from what has been released.
 */
function createHarness(initialize?: () => Promise<void>) {
  const calls: string[] = [];
  const dependencies: ChatOverlayApplicationDependencies = {
    createLiveRuntime: () => {
      calls.push("runtime.create");
      return {
        initialize: () => {
          calls.push("runtime.initialize");
          return initialize ? initialize() : Promise.resolve();
        },
        updateConfig: () => calls.push("runtime.updateConfig"),
        debugDisconnect: () => calls.push("runtime.debugDisconnect"),
        debugReconnect: () => calls.push("runtime.debugReconnect"),
        destroy: () => calls.push("runtime.destroy"),
      };
    },
    createPreviewRuntime: () => {
      throw new Error("the preview runtime should not be built for a live application");
    },
    createPredictionsRuntime: () => {
      calls.push("predictions.create");
      return {
        update: () => calls.push("predictions.update"),
        destroy: () => calls.push("predictions.destroy"),
      };
    },
  };

  const application = new ChatOverlayApplication(
    {
      channel: "streamer",
      initialConfig,
      mode: "live",
      previewDemoKind: "pasta",
    },
    createHooks(),
    dependencies,
  );

  return { application, calls };
}

const originalWindow = (globalThis as { window?: unknown }).window;

function installWindowShim() {
  const listeners = new Set<unknown>();
  (globalThis as unknown as { window: unknown }).window = {
    addEventListener: (_type: string, listener: unknown) => listeners.add(listener),
    removeEventListener: (_type: string, listener: unknown) => listeners.delete(listener),
  };
  return listeners;
}

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window;
  else (globalThis as unknown as { window: unknown }).window = originalWindow;
});

describe("chat overlay application lifecycle", () => {
  test("debug connection controls cannot restart a destroyed runtime", () => {
    installWindowShim();
    const { application, calls } = createHarness();
    application.debugDisconnect();
    application.debugReconnect();
    expect(calls).toContain("runtime.debugDisconnect");
    expect(calls).toContain("runtime.debugReconnect");
    application.destroy();
    application.debugDisconnect();
    application.debugReconnect();
    expect(calls.filter((call) => call === "runtime.debugDisconnect")).toHaveLength(1);
    expect(calls.filter((call) => call === "runtime.debugReconnect")).toHaveLength(1);
  });

  test("destroy before start releases the runtimes the constructor built", () => {
    installWindowShim();
    const { application, calls } = createHarness();

    expect(calls).toEqual(["predictions.create", "runtime.create"]);

    application.destroy();

    expect(calls).toEqual([
      "predictions.create",
      "runtime.create",
      "predictions.destroy",
      "runtime.destroy",
    ]);
  });

  test("destroy does not release an already released application twice", () => {
    installWindowShim();
    const { application, calls } = createHarness();

    application.destroy();
    application.destroy();

    expect(calls.filter((call) => call === "runtime.destroy")).toHaveLength(1);
    expect(calls.filter((call) => call === "predictions.destroy")).toHaveLength(1);
  });

  test("start initializes once and detaches its message listener on destroy", async () => {
    const listeners = installWindowShim();
    const { application, calls } = createHarness();

    await application.start();
    await application.start();

    expect(calls.filter((call) => call === "runtime.initialize")).toHaveLength(1);
    expect(listeners.size).toBe(1);

    application.destroy();
    expect(listeners.size).toBe(0);
  });

  test("start after destroy does not resurrect the application", async () => {
    installWindowShim();
    const { application, calls } = createHarness();

    application.destroy();
    await application.start();

    expect(calls.filter((call) => call === "runtime.initialize")).toHaveLength(0);
    expect(calls.filter((call) => call === "runtime.destroy")).toHaveLength(1);
  });

  test("destroy during a pending initialization leaves no owner behind", async () => {
    const listeners = installWindowShim();
    const initialization = deferred<void>();
    const { application, calls } = createHarness(() => initialization.promise);

    const started = application.start();
    expect(calls).toContain("runtime.initialize");

    application.destroy();
    initialization.resolve();
    await started;

    // The runtime was released while its initialize was still awaiting, and the
    // resolved initialization did not re-attach the listener or restart it.
    expect(calls.filter((call) => call === "runtime.destroy")).toHaveLength(1);
    expect(listeners.size).toBe(0);
    expect(calls.filter((call) => call === "runtime.initialize")).toHaveLength(1);
  });
});
