import { afterEach, describe, expect, test } from "bun:test";
import type { ChatConfig } from "../src/config/chatUrlParams";
import { badgeService } from "../src/services/badges";
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
  getEmote?: (...args: any[]) => any;
  loadSharedChannel?: (...args: any[]) => Promise<any>;
  onMessageRefresh?: (messageId: string) => void;
}) {
  const service = {
    shouldDisplayMessage: () => true,
    getEmote: options.getEmote ?? (() => undefined),
  };

  return new MessagePreparationPipeline({
    announcementColorResolver: {
      apply: options.apply ?? (async () => {}),
    } as any,
    assetLoader: {
      resolveReward: options.resolveReward ?? (async () => null),
      loadSharedChannel: options.loadSharedChannel ?? (async () => null),
    } as any,
    getConfig: () => ({}) as ChatConfig,
    getService: () => service as any,
    onMessageRefresh: options.onMessageRefresh ?? (() => {}),
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

  test("resolves third-party emotes against the Shared Chat source channel", async () => {
    const lookups: any[][] = [];
    const pipeline = createPipeline({
      getEmote: (...args) => {
        lookups.push(args);
        return { name: args[0] };
      },
    });

    await pipeline.prepare(
      message({ message: "SourceEmote", sourceChannelId: "200" }),
    );

    expect(lookups).toContainEqual(["SourceEmote", "viewer", "200"]);
  });

  test("loads Shared Chat assets without delaying the message", async () => {
    const originalLoadUserBadges = badgeService.loadUserBadges;
    badgeService.loadUserBadges = async () => [];
    const sourceAssets = deferred<{
      login: string;
      displayName: string;
      profileImageUrl: string;
    }>();
    const refreshed: string[] = [];
    const pipeline = createPipeline({
      loadSharedChannel: () => sourceAssets.promise,
      onMessageRefresh: (messageId) => refreshed.push(messageId),
    });

    try {
      const prepared = await pipeline.prepare(
        message({
          platform: "twitch",
          sourceChannelId: "200",
          targetChannelId: "100",
        }),
      );

      expect(prepared).not.toBeNull();
      expect(prepared?.sourceChannelAvatarUrl).toBeUndefined();

      sourceAssets.resolve({
        login: "source",
        displayName: "Source Channel",
        profileImageUrl: "https://example.com/source.png",
      });
      await sourceAssets.promise;
      await Promise.resolve();

      expect(prepared).toMatchObject({
        sourceChannelLogin: "source",
        sourceChannelDisplayName: "Source Channel",
        sourceChannelAvatarUrl: "https://example.com/source.png",
      });
      expect(refreshed).toEqual(["message-1"]);
    } finally {
      badgeService.loadUserBadges = originalLoadUserBadges;
    }
  });

  test("shows channel avatars on every message after multiple channels appear", async () => {
    const originalLoadUserBadges = badgeService.loadUserBadges;
    badgeService.loadUserBadges = async () => [];
    const refreshed: string[] = [];
    const pipeline = createPipeline({
      loadSharedChannel: async (channelId: string) => ({
        login: `channel_${channelId}`,
        displayName: `Channel ${channelId}`,
        profileImageUrl: `https://example.com/${channelId}.png`,
      }),
      onMessageRefresh: (messageId) => refreshed.push(messageId),
    });

    try {
      const primary = await pipeline.prepare(
        message({
          id: "primary-message",
          platform: "twitch",
          targetChannelId: "100",
        }),
      );
      expect(primary?.showSourceChannelBadge).toBeUndefined();

      const shared = await pipeline.prepare(
        message({
          id: "shared-message",
          platform: "twitch",
          sourceChannelId: "200",
          targetChannelId: "100",
        }),
      );
      await Promise.resolve();

      expect(primary).toMatchObject({
        showSourceChannelBadge: true,
        sourceChannelAvatarUrl: "https://example.com/100.png",
      });
      expect(shared).toMatchObject({
        showSourceChannelBadge: true,
        sourceChannelAvatarUrl: "https://example.com/200.png",
      });
      expect(refreshed).toContain("primary-message");
      expect(refreshed).toContain("shared-message");
    } finally {
      badgeService.loadUserBadges = originalLoadUserBadges;
    }
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
  test("scrolls restored messages after the DOM render frame", () => {
    const frames: FrameRequestCallback[] = [];
    (globalThis as any).window = {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      },
    };

    const scrollCalls: Array<{ behavior: ScrollBehavior; force: boolean }> = [];
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
    (runtime as any).activeConfig = { animation: "none" } as ChatConfig;
    (runtime as any).chatService = {
      scrollToLatest: (behavior: ScrollBehavior, force = false) => {
        scrollCalls.push({ behavior, force });
      },
    };

    (runtime as any).scrollToLatestAfterRender();

    expect(scrollCalls).toEqual([]);
    expect(frames).toHaveLength(1);
    frames[0](0);
    expect(scrollCalls).toEqual([{ behavior: "auto", force: false }]);
  });

  test("forces restored history to the latest position", () => {
    const frames: FrameRequestCallback[] = [];
    (globalThis as any).window = {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      },
    };

    const scrollCalls: Array<{ behavior: ScrollBehavior; force: boolean }> = [];
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
    (runtime as any).activeConfig = { animation: "none" } as ChatConfig;
    (runtime as any).chatService = {
      scrollToLatest: (behavior: ScrollBehavior, force = false) => {
        scrollCalls.push({ behavior, force });
      },
    };

    (runtime as any).scrollToLatestAfterRender(true);
    frames[0](0);

    expect(scrollCalls).toEqual([{ behavior: "auto", force: true }]);
  });

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
