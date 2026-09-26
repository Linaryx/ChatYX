import { describe, expect, test } from "bun:test";
import { getChatEventStyleVariables } from "../src/styles/chatEventStyles";
import { generateSizeStyles, SIZE_CONFIGS } from "../src/styles/chatStyles";
import { DEFAULT_EVENT_COLORS } from "../src/config/eventColors";

describe("chat event style variables", () => {
  test("uses the configured color for each semantic event", () => {
    const variables = getChatEventStyleVariables({
      event: { type: "reward", label: "" },
      colors: { ...DEFAULT_EVENT_COLORS, eventColorReward: "#ff00ff" }, opacity: 35,
    });

    expect(variables["--chat-event-color"]).toBe("#ff00ff");
    expect(variables["--chat-event-opacity"]).toBe("35%");
  });

  test("allows Twitch announcement levels to provide their resolved accent", () => {
    const variables = getChatEventStyleVariables({
      event: { type: "announcement", label: "", level: "GREEN" },
      colors: { ...DEFAULT_EVENT_COLORS, eventColorAnnGreen: "#abcdef" }, opacity: 0,
    });

    expect(variables["--chat-event-color"]).toBe("#abcdef");
  });

  test("falls back safely when an event color is invalid", () => {
    const variables = getChatEventStyleVariables({
      event: {
        type: "announcement",
        label: "",
      },
      colors: { ...DEFAULT_EVENT_COLORS, eventColorAnnPrimary: "url(javascript:invalid)" }, opacity: 22,
    });

    expect(variables["--chat-event-color"]).toBe(DEFAULT_EVENT_COLORS.eventColorAnnPrimary);
  });

  test("publishes the configured gigantified emote width for every size preset", () => {
    for (const size of [1, 2, 3] as const) {
      expect(generateSizeStyles(size)).toContain(
        `--gigantified-emote-width: ${SIZE_CONFIGS[size].gigantifiedEmoteWidth}`,
      );
    }
  });

  test("scales the message line height", () => {
    expect(generateSizeStyles(1, 150)).toContain("line-height: 45px");
  });
});
