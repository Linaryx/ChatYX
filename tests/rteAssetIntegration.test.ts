import { describe, expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG, type ChatConfig } from "../src/config/chatUrlParams";
import type { Badge } from "../src/services/badges/badgeService";
import {
  ChatPresentationService,
  createChatPresentationConfig,
} from "../src/services/chat/chatPresentationService";
import { ChatAssetLoader } from "../src/services/chat/runtime/chatAssetLoader";
import type { Paint } from "../src/services/chat/sevenTVPaintService";
import type { TwitchMessage } from "../src/services/chat/twitchService";

function config(overrides: Partial<ChatConfig> = {}): ChatConfig {
  return { ...DEFAULT_CHAT_CONFIG, ...overrides };
}

function message(): TwitchMessage {
  return {
    id: "message-1",
    userId: "123",
    username: "Alice",
    displayName: "Alice",
    message: "hello",
    color: "#fff",
    badges: [],
    emotes: {},
    userType: "",
    isModerator: false,
    isSubscriber: false,
    timestamp: new Date(0),
  };
}

describe("RTE asset and presentation integration", () => {
  test("does not load RTE user assets when both presentation flags are disabled", async () => {
    let badgeCalls = 0;
    let paintCalls = 0;
    const loader = new ChatAssetLoader("channel", {
      loadBadge: async () => {
        badgeCalls += 1;
        return null;
      },
      loadPaint: async () => {
        paintCalls += 1;
        return null;
      },
    });
    const presentation = new ChatPresentationService(
      createChatPresentationConfig(config()),
    );

    await loader.loadRteUserAssets(config(), message(), presentation);

    expect(badgeCalls).toBe(0);
    expect(paintCalls).toBe(0);
  });

  test("hydrates a valid badge and paint through existing presentation seams", async () => {
    const badge: Badge = {
      source: "rte-reyohoho",
      description: "Reyohoho",
      url: "https://cdn.example.com/reyohoho.webp",
    };
    const paint: Paint = {
      id: "paint-1",
      name: "Gold",
      function: "SOLID",
      color: 0xffcc00,
      stops: [],
      shadows: [],
    };
    const enabled = config({
      rteReyohohoBadge: true,
      rteCustomCosmetics: true,
    });
    const loader = new ChatAssetLoader("channel", {
      loadBadge: async () => badge,
      loadPaint: async () => paint,
    });
    const presentation = new ChatPresentationService(
      createChatPresentationConfig(enabled),
    );

    expect(
      await loader.loadRteUserAssets(enabled, message(), presentation),
    ).toBe(true);
    expect(presentation.getBadges("Alice")).toContainEqual(badge);
    expect(presentation.getUserPaint("123", "Alice")).toContain("#ffcc00");
  });
});
