import { describe, expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG } from "../src/config/chatUrlParams";
import {
  createChatPreviewConfigMessage,
  getChatPreviewSessionKey,
  isChatPreviewConfigMessage,
} from "../src/services/chat/preview/configMessage";

describe("preview config messages", () => {
  test("recognizes config messages", () => {
    const message = createChatPreviewConfigMessage({
      ...DEFAULT_CHAT_CONFIG,
      channel: "forsen",
    });

    expect(isChatPreviewConfigMessage(message)).toBe(true);
    expect(isChatPreviewConfigMessage({ type: "other" })).toBe(false);
  });

  test("does not restart the preview session for visual changes", () => {
    const initial = { ...DEFAULT_CHAT_CONFIG, channel: "forsen" };
    const restyled = {
      ...initial,
      font: 5,
      fontWeight: 500,
      overlayBackgroundColor: "#ff0000",
      size: 3,
    };

    expect(getChatPreviewSessionKey(initial, "demo", "pasta")).toBe(
      getChatPreviewSessionKey(restyled, "demo", "pasta"),
    );
  });

  test("restarts the preview session when its data source changes", () => {
    const initial = { ...DEFAULT_CHAT_CONFIG, channel: "forsen" };
    const otherChannel = { ...initial, channel: "xqc" };

    expect(getChatPreviewSessionKey(initial, "demo", "pasta")).not.toBe(
      getChatPreviewSessionKey(otherChannel, "demo", "pasta"),
    );
    expect(getChatPreviewSessionKey(initial, "demo", "pasta")).not.toBe(
      getChatPreviewSessionKey(initial, "live", "pasta"),
    );
  });
});
