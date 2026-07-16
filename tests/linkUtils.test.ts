import { describe, expect, test } from "bun:test";
import type { TwitchMessage } from "../src/services/chat";
import {
  containsLink,
  shouldHideLinkedReward,
  tokenizeLinks,
} from "../src/utils/chat/linkUtils";

function rewardMessage(overrides: Partial<TwitchMessage> = {}): TwitchMessage {
  return {
    id: "reward-message",
    username: "viewer",
    displayName: "Viewer",
    message: "обычный текст",
    color: "#ffffff",
    badges: [],
    emotes: {},
    userType: "",
    isModerator: false,
    isSubscriber: false,
    timestamp: new Date(0),
    twitchEvent: { type: "reward", label: "Награда" },
    ...overrides,
  };
}

describe("chat links", () => {
  test("recognizes scheme, www, and bare-domain links", () => {
    expect(containsLink("https://example.com/path?q=1")).toBe(true);
    expect(containsLink("www.example.com/test")).toBe(true);
    expect(containsLink("example.com/test")).toBe(true);
    expect(containsLink("viewer@example.com")).toBe(false);
  });

  test("does not recognize unsupported schemes or links glued on the left", () => {
    expect(containsLink("wss://ytwss.ruina.team")).toBe(false);
    expect(containsLink("penis://example.com")).toBe(false);
    expect(containsLink("словоhttps://example.com")).toBe(false);
    expect(containsLink("адрес:https://example.com")).toBe(false);
    expect(containsLink("смотри https://example.com")).toBe(true);
  });

  test("leaves unsupported adjacent characters outside the link", () => {
    expect(
      tokenizeLinks("https://example.com/путь🔥продолжение"),
    ).toEqual([
      { kind: "link", value: "https://example.com/" },
      { kind: "text", value: "путь🔥продолжение" },
    ]);
    expect(tokenizeLinks("https://localhost:9905чат")).toEqual([
      { kind: "link", value: "https://localhost:9905" },
      { kind: "text", value: "чат" },
    ]);
  });

  test("keeps punctuation outside the link segment", () => {
    expect(tokenizeLinks("Смотри https://example.com/test). Потом")).toEqual([
      { kind: "text", value: "Смотри " },
      { kind: "link", value: "https://example.com/test" },
      { kind: "text", value: ")." },
      { kind: "text", value: " Потом" },
    ]);
  });

  test("hides linked rewards only when the policy is enabled", () => {
    const linked = rewardMessage({ message: "https://example.com" });
    expect(shouldHideLinkedReward(linked, { hideLinkRewards: true })).toBe(true);
    expect(shouldHideLinkedReward(linked, { hideLinkRewards: false })).toBe(false);
    expect(
      shouldHideLinkedReward(
        rewardMessage({
          message: "без ссылки",
          channelPointReward: {
            id: "reward",
            title: "Награда",
            prompt: "Открой example.com",
            cost: 100,
          },
        }),
        { hideLinkRewards: true },
      ),
    ).toBe(true);
  });
});
