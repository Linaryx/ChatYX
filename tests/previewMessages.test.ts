import { describe, expect, test } from "bun:test";
import type { ChatPresentationService } from "../src/services/chat";
import {
  createPreviewMessages,
  resetUserPool,
} from "../src/services/chat/preview";
import { isReplyEligibleEvent } from "../src/utils/chat/replyEligibility";

const service = {} as ChatPresentationService;

describe("chat preview messages", () => {
  test("does not attach replies to rewards, raids, or announcements", () => {
    resetUserPool();
    const messages = createPreviewMessages("channel", service, "0", "pasta", 13);

    const reward = messages.find((message) => message.twitchEvent?.type === "reward");
    const raid = messages.find((message) => message.twitchEvent?.type === "raid");
    const announcement = messages.find(
      (message) => message.twitchEvent?.type === "announcement",
    );

    expect(reward?.reply).toBeUndefined();
    expect(raid?.reply).toBeUndefined();
    expect(announcement?.reply).toBeUndefined();
  });

  test("uses varied chat messages in the default demo", () => {
    resetUserPool();
    const messages = createPreviewMessages("channel", service, "0", "pasta", 10);
    const chatTexts = messages
      .filter((message) => !message.twitchEvent)
      .map((message) => message.message);

    expect(new Set(chatTexts).size).toBeGreaterThan(1);
  });

  test("limits reply previews to reply-capable authored messages", () => {
    expect(isReplyEligibleEvent(undefined)).toBeTrue();
    expect(isReplyEligibleEvent("first-message")).toBeTrue();
    expect(isReplyEligibleEvent("highlighted-message")).toBeTrue();
    expect(isReplyEligibleEvent("reward")).toBeFalse();
    expect(isReplyEligibleEvent("announcement")).toBeFalse();
  });
});
