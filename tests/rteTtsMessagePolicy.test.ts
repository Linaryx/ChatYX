import { describe, expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG, type ChatConfig } from "../src/config/chatUrlParams";
import { getRteChatSpeechRequest } from "../src/services/chat/rteTtsMessagePolicy";
import type { TwitchMessage } from "../src/services/chat/twitchService";

function config(overrides: Partial<ChatConfig> = {}): ChatConfig {
  return {
    ...DEFAULT_CHAT_CONFIG,
    rteAzureTts: true,
    ttsReadChat: true,
    botNames: "nightbot,streamelements",
    ...overrides,
  };
}

function message(overrides: Partial<TwitchMessage> = {}): TwitchMessage {
  return {
    id: "message-1",
    userId: "user-1",
    username: "viewer",
    displayName: "Viewer",
    message: "hello chat",
    color: "#fff",
    badges: [],
    emotes: {},
    userType: "",
    isModerator: false,
    isSubscriber: false,
    timestamp: new Date(0),
    ...overrides,
  };
}

describe("RTE all-chat TTS policy", () => {
  test("reads a non-command message after it reaches the displayed-message seam", () => {
    expect(getRteChatSpeechRequest(config(), message())).toEqual({
      provider: "azure",
      messageId: "message-1",
      userId: "user-1",
      username: "viewer",
      text: "hello chat",
    });
  });

  test("does not read chat unless both TTS and all-chat mode are enabled", () => {
    expect(
      getRteChatSpeechRequest(config({ rteAzureTts: false }), message()),
    ).toBeNull();
    expect(
      getRteChatSpeechRequest(config({ ttsReadChat: false }), message()),
    ).toBeNull();
  });

  test("never reads command messages in all-chat mode", () => {
    expect(
      getRteChatSpeechRequest(config(), message({ message: "!chat ping" })),
    ).toBeNull();
    expect(
      getRteChatSpeechRequest(config(), message({ message: "/me waves" })),
    ).toBeNull();
  });

  test("filters known bots independently of visual bot visibility", () => {
    const botMessage = message({ username: "NightBot" });

    expect(getRteChatSpeechRequest(config({ bots: true }), botMessage)).toBeNull();
    expect(
      getRteChatSpeechRequest(
        config({ bots: true, ttsReadBots: true }),
        botMessage,
      ),
    ).not.toBeNull();
  });
});
