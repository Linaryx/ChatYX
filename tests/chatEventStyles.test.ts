import { describe, expect, test } from "bun:test";
import { getChatEventStyleVariables } from "../src/styles/chatEventStyles";
import { generateSizeStyles, SIZE_CONFIGS } from "../src/styles/chatStyles";

describe("chat event style variables", () => {
  test("omits the inline accent when CSS owns a semantic event color", () => {
    const variables = getChatEventStyleVariables({
      event: { type: "reward", label: "", color: "#ff00ff" },
      fallbackAccent: "#9146ff",
      backgroundOpacity: 22,
    });

    expect(variables["--chat-event-accent"]).toBeUndefined();
    expect(variables["--chat-event-fallback-accent"]).toBe("#9146ff");
    expect(variables["--chat-event-background-opacity"]).toBe("22%");
  });

  test("allows Twitch announcement levels to provide their resolved accent", () => {
    const variables = getChatEventStyleVariables({
      event: {
        type: "announcement",
        label: "",
        level: "GREEN",
        color: "#00c800",
      },
      fallbackAccent: "#9146ff",
      backgroundOpacity: 15,
    });

    expect(variables["--chat-event-accent"]).toBe("#00c800");
  });

  test("falls back safely when an announcement accent is invalid", () => {
    const variables = getChatEventStyleVariables({
      event: {
        type: "announcement",
        label: "",
        color: "url(javascript:invalid)",
      },
      fallbackAccent: "#123456",
      backgroundOpacity: 15,
    });

    expect(variables["--chat-event-accent"]).toBe("#123456");
  });

  test("clamps event tint opacity to a valid percentage", () => {
    const variables = getChatEventStyleVariables({
      event: { type: "raid", label: "" },
      fallbackAccent: "#9146ff",
      backgroundOpacity: 140,
    });

    expect(variables["--chat-event-background-opacity"]).toBe("100%");
  });

  test("publishes the configured gigantified emote width for every size preset", () => {
    for (const size of [1, 2, 3] as const) {
      expect(generateSizeStyles(size)).toContain(
        `--gigantified-emote-width: ${SIZE_CONFIGS[size].gigantifiedEmoteWidth}`,
      );
    }
  });
});
