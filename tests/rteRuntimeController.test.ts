import { describe, expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG, type ChatConfig } from "../src/config/chatUrlParams";
import { RteRuntimeController } from "../src/services/chat/rteRuntimeController";
import type {
  RteTtsConfig,
  RteTtsRequest,
  RteTtsUser,
} from "../src/services/chat/rteTtsTypes";
import type { TwitchMessage } from "../src/services/chat/twitchService";

class FakeTtsRuntime {
  configs: RteTtsConfig[] = [];
  requests: RteTtsRequest[] = [];
  canceledMessages: string[] = [];
  canceledUsers: RteTtsUser[] = [];
  skipCalls = 0;
  clearCalls = 0;
  stopCalls = 0;
  destroyCalls = 0;

  updateConfig(config: RteTtsConfig): void {
    this.configs.push(config);
  }

  enqueue(request: RteTtsRequest) {
    this.requests.push(request);
    return { kind: "accepted" } as const;
  }

  skip(): void {
    this.skipCalls += 1;
  }

  clear(): void {
    this.clearCalls += 1;
  }

  stop(): void {
    this.stopCalls += 1;
  }

  cancelMessage(messageId: string): void {
    this.canceledMessages.push(messageId);
  }

  cancelUser(user: RteTtsUser): void {
    this.canceledUsers.push(user);
  }

  cancelAll(): void {
    this.stopCalls += 1;
  }

  destroy(): void {
    this.destroyCalls += 1;
  }
}

function config(overrides: Partial<ChatConfig> = {}): ChatConfig {
  return {
    ...DEFAULT_CHAT_CONFIG,
    rteAzureTts: true,
    ttsReadChat: true,
    ...overrides,
  };
}

function message(overrides: Partial<TwitchMessage> = {}): TwitchMessage {
  return {
    id: "message-1",
    userId: "user-1",
    username: "moderator",
    displayName: "Moderator",
    message: "hello",
    color: "#fff",
    badges: ["moderator/1"],
    emotes: {},
    userType: "mod",
    isModerator: true,
    isSubscriber: false,
    timestamp: new Date(0),
    ...overrides,
  };
}

describe("RTE runtime controller", () => {
  test("maps resolved runtime config into the TTS service", () => {
    const tts = new FakeTtsRuntime();
    const controller = new RteRuntimeController(tts);

    controller.updateConfig(
      config({
        ttsVoice: "en-US-GuyNeural",
        ttsVolume: 0.25,
        ttsMaxLength: 250,
      }),
    );

    expect(tts.configs).toEqual([
      {
        azureEnabled: true,
        chatisEnabled: false,
        azureVoice: "en-US-GuyNeural",
        chatisVoice: "Brian",
        volume: 0.25,
        maxLength: 250,
      },
    ]);
  });

  test("queues displayed all-chat messages through the policy", () => {
    const tts = new FakeTtsRuntime();
    const controller = new RteRuntimeController(tts);
    controller.updateConfig(config());

    controller.handleDisplayedMessage(message());

    expect(tts.requests).toEqual([
      {
        provider: "azure",
        messageId: "message-1",
        userId: "user-1",
        username: "moderator",
        text: "hello",
      },
    ]);
  });

  test("dispatches authorized TTS grammar to queue controls", () => {
    const tts = new FakeTtsRuntime();
    const controller = new RteRuntimeController(tts);
    controller.updateConfig(config());
    const source = message();

    controller.handleAuthorizedCommand("azure", "-v en-US-GuyNeural hello", source);
    controller.handleAuthorizedCommand("azure", "skip", source);
    controller.handleAuthorizedCommand("azure", "clear", source);
    controller.handleAuthorizedCommand("azure", "stop", source);

    expect(tts.requests[0]).toEqual({
      provider: "azure",
      messageId: "message-1",
      userId: "user-1",
      username: "moderator",
      text: "hello",
      voice: "en-US-GuyNeural",
    });
    expect(tts.skipCalls).toBe(1);
    expect(tts.clearCalls).toBe(1);
    expect(tts.stopCalls).toBe(1);
  });

  test("uses ChatIS for normal TTS commands and all-chat speech when enabled", () => {
    const tts = new FakeTtsRuntime();
    const controller = new RteRuntimeController(tts);
    controller.updateConfig(config({ rteAzureTts: false, rteChatIsTts: true }));
    const source = message();

    controller.handleAuthorizedCommand("chatis", "-s Brian hello", source);
    controller.handleDisplayedMessage(message({ id: "message-2", message: "all chat" }));

    expect(tts.requests).toEqual([
      {
        provider: "chatis",
        messageId: "message-1",
        userId: "user-1",
        username: "moderator",
        text: "hello",
        voice: "Brian",
      },
      {
        provider: "chatis",
        messageId: "message-2",
        userId: "user-1",
        username: "moderator",
        text: "all chat",
      },
    ]);
  });

  test("forwards moderation cancellation and cleanup", () => {
    const tts = new FakeTtsRuntime();
    const controller = new RteRuntimeController(tts);

    controller.cancelMessage("message-1");
    controller.cancelUser({ username: "alice" });
    controller.cancelAll();
    controller.destroy();

    expect(tts.canceledMessages).toEqual(["message-1"]);
    expect(tts.canceledUsers).toEqual([{ username: "alice" }]);
    expect(tts.stopCalls).toBe(1);
    expect(tts.destroyCalls).toBe(1);
  });
});
