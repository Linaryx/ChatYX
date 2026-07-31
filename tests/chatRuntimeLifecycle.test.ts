import { afterEach, describe, expect, test } from "bun:test";
import type { ChatConfig } from "../src/config/chatUrlParams";
import { OverlayRuntime } from "../src/services/chat/overlayRuntime";
import { MessagePreparationPipeline } from "../src/services/chat/runtime/messagePreparationPipeline";
import type { TwitchMessage } from "../src/services/chat/twitchService";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function message(overrides: Partial<TwitchMessage> = {}): TwitchMessage {
  return {
    id: "message-1",
    username: "viewer",
    displayName: "Viewer",
    message: "hello",
    color: "#fff",
    badges: [],
    emotes: {},
    userType: "",
    isModerator: false,
    isSubscriber: false,
    timestamp: new Date(0),
    platform: "youtube",
    ...overrides,
  };
}

function createPipeline(options: {
  resolveReward?: () => Promise<null>;
  apply?: () => Promise<void>;
}) {
  const service = {
    shouldDisplayMessage: () => true,
    getEmote: () => undefined,
  };

  return new MessagePreparationPipeline({
    announcementColorResolver: {
      apply: options.apply ?? (async () => {}),
    } as any,
    assetLoader: {
      resolveReward: options.resolveReward ?? (async () => null),
    } as any,
    getConfig: () => ({}) as ChatConfig,
    getService: () => service as any,
    onMessageRefresh: () => {},
  });
}

describe("chat message preparation cancellation", () => {
  test("does not return a deleted message after reward resolution finishes", async () => {
    const reward = deferred<null>();
    const pipeline = createPipeline({ resolveReward: () => reward.promise });
    const pending = pipeline.prepare(message({ customRewardId: "reward-1" }));

    pipeline.cancelMessage("message-1");
    reward.resolve(null);

    expect(await pending).toBeNull();
  });

  test("does not return a user message canceled during announcement resolution", async () => {
    const announcement = deferred<void>();
    const pipeline = createPipeline({ apply: () => announcement.promise });
    const pending = pipeline.prepare(message());

    pipeline.cancelUser("VIEWER");
    announcement.resolve();

    expect(await pending).toBeNull();
  });

  test("does not return messages still preparing when chat is cleared", async () => {
    const announcement = deferred<void>();
    const pipeline = createPipeline({ apply: () => announcement.promise });
    const pending = pipeline.prepare(message({ id: "message-2" }));

    pipeline.cancelPending();
    announcement.resolve();

    expect(await pending).toBeNull();
  });
});

const originalWindow = (globalThis as any).window;
const originalDocument = (globalThis as any).document;

afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as any).window;
  else (globalThis as any).window = originalWindow;
  if (originalDocument === undefined) delete (globalThis as any).document;
  else (globalThis as any).document = originalDocument;
});

describe("overlay runtime lifecycle", () => {
  test("destroy invalidates an initialization waiting for channel identity", async () => {
    let listenerAdds = 0;
    (globalThis as any).window = {
      location: { search: "" },
      setTimeout,
      clearTimeout,
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      addEventListener: () => {
        listenerAdds += 1;
      },
      removeEventListener: () => {},
    };
    (globalThis as any).document = {
      head: { appendChild: () => {} },
      createElement: () => ({
        id: "",
        innerHTML: "",
        style: {},
        remove: () => {},
      }),
      getElementById: () => null,
      querySelectorAll: () => [],
    };

    const identity = deferred<{ channelId: string; displayName: string }>();
    let channelResolved = 0;
    const runtime = new OverlayRuntime("channel", {
      onConfigResolved: () => {},
      onServiceReady: () => {},
      onLoadingChange: () => {},
      onCommandStatusChange: () => {},
      onConnectionChange: () => {},
      onMessagesChange: () => {},
      onAnimationDurationChange: () => {},
      onChannelResolved: () => {
        channelResolved += 1;
      },
    });
    (runtime as any).channelIdentityResolver.resolve = () => identity.promise;

    const initialization = runtime.initialize();
    runtime.destroy();
    identity.resolve({ channelId: "123", displayName: "Channel" });
    await initialization;

    expect(channelResolved).toBe(0);
    expect(listenerAdds).toBe(0);
    expect((runtime as any).initialized).toBe(false);
  });

  test("does not wait for emote loading before connecting", async () => {
    (globalThis as any).window = {
      location: { search: "?rm=false" },
      setTimeout,
      clearTimeout,
      requestAnimationFrame: () => 1,
      cancelAnimationFrame: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (globalThis as any).document = {
      head: { appendChild: () => {} },
      createElement: () => ({
        id: "",
        innerHTML: "",
        style: {},
        remove: () => {},
      }),
      getElementById: () => null,
      querySelectorAll: () => [],
    };

    const emotes = deferred<void>();
    let twitchConnections = 0;
    const runtime = new OverlayRuntime("channel", {
      onConfigResolved: () => {},
      onServiceReady: () => {},
      onLoadingChange: () => {},
      onCommandStatusChange: () => {},
      onConnectionChange: () => {},
      onMessagesChange: () => {},
      onAnimationDurationChange: () => {},
      onChannelResolved: () => {},
    });
    (runtime as any).channelIdentityResolver.resolve = async () => ({
      channelId: "",
      displayName: "Channel",
    });
    (runtime as any).announcementColorResolver.preload = () => {};
    (runtime as any).assetLoader.preloadChannelRewards = () => {};
    (runtime as any).assetLoader.loadEmotes = () => emotes.promise;
    (runtime as any).assetLoader.loadDeferredAssets = async () => [];
    (runtime as any).connectionManager.connectTwitch = () => {
      twitchConnections += 1;
    };
    (runtime as any).connectionManager.connectYouTube = () => {};

    await runtime.initialize();

    expect(twitchConnections).toBe(1);
    runtime.destroy();
    emotes.resolve();
  });
});
