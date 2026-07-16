import { describe, expect, test } from "bun:test";
import type { ChatPresentationService } from "../src/services/chat";
import {
  createPreviewMessages,
  resetUserPool,
} from "../src/services/chat/preview";

const service = {} as ChatPresentationService;

describe("chat preview messages", () => {
  test("does not attach replies to rewards or raids", () => {
    resetUserPool();
    const messages = createPreviewMessages("channel", service, "0", "pasta", 11);

    const reward = messages.find((message) => message.twitchEvent?.type === "reward");
    const raid = messages.find((message) => message.twitchEvent?.type === "raid");

    expect(reward?.reply).toBeUndefined();
    expect(raid?.reply).toBeUndefined();
  });

  test("uses varied chat messages in the default demo", () => {
    resetUserPool();
    const messages = createPreviewMessages("channel", service, "0", "pasta", 10);
    const chatTexts = messages
      .filter((message) => !message.twitchEvent)
      .map((message) => message.message);

    expect(new Set(chatTexts).size).toBeGreaterThan(1);
  });
});
