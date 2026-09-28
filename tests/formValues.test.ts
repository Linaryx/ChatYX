import { expect, test } from "bun:test";
import {
  DEFAULT_CHAT_CONFIG,
  chatConfigToSearchParams,
  parseChatConfigFromSearchParams,
  type ChatConfig,
} from "../src/config/chatUrlParams";
import {
  normalizeHexColor,
  toClampedInt,
  toFloat,
  toInt,
  toPositiveIntOrFalse,
} from "../src/config/formValues";

test("normalizeHexColor accepts a plain six-digit colour with or without the hash", () => {
  expect(normalizeHexColor("#AbCdEf", "#000000")).toBe("#AbCdEf");
  expect(normalizeHexColor("AbCdEf", "#000000")).toBe("#AbCdEf");
  expect(normalizeHexColor("  #abcdef  ", "#000000")).toBe("#abcdef");
});

test("normalizeHexColor rejects a value of the wrong length or alphabet", () => {
  expect(normalizeHexColor("#abc", "#ffffff")).toBe("#ffffff");
  expect(normalizeHexColor("#gggggg", "#ffffff")).toBe("#ffffff");
  expect(normalizeHexColor("", "#ffffff")).toBe("#ffffff");
});

test("normalizeHexColor only accepts the alpha suffix when asked", () => {
  expect(normalizeHexColor("#11223380", "#ffffff", true)).toBe("#11223380");
  expect(normalizeHexColor("#11223380", "#ffffff", false)).toBe("#ffffff");
  expect(normalizeHexColor("#1122338", "#ffffff", true)).toBe("#ffffff");
});

test("numeric coercion falls back instead of producing NaN", () => {
  expect(toInt("42", 7)).toBe(42);
  expect(toInt("abc", 7)).toBe(7);
  expect(toInt("", 7)).toBe(7);

  expect(toFloat("1.35", 1)).toBe(1.35);
  expect(toFloat("nope", 1)).toBe(1);

  expect(toClampedInt("150", 100, 80, 200)).toBe(150);
  expect(toClampedInt("500", 100, 80, 200)).toBe(200);
  expect(toClampedInt("1", 100, 80, 200)).toBe(80);
  expect(toClampedInt("abc", 100, 80, 200)).toBe(100);
});

test("toPositiveIntOrFalse treats zero and negatives as off", () => {
  expect(toPositiveIntOrFalse("4")).toBe(4);
  expect(toPositiveIntOrFalse("0")).toBe(false);
  expect(toPositiveIntOrFalse("-3")).toBe(false);
  expect(toPositiveIntOrFalse("abc")).toBe(false);
});

test("form coercion and url parsing agree on the shared value shapes", () => {
  const config: ChatConfig = {
    ...DEFAULT_CHAT_CONFIG,
    size: toInt("2", DEFAULT_CHAT_CONFIG.size),
    lineHeight: toClampedInt("150", DEFAULT_CHAT_CONFIG.lineHeight, 80, 200),
    emoteScale: toFloat("1.35", DEFAULT_CHAT_CONFIG.emoteScale),
    shadow: toPositiveIntOrFalse("4"),
    stroke: toPositiveIntOrFalse("0"),
    fade: toPositiveIntOrFalse("7"),
    overlayBorderColor: normalizeHexColor("#AbCdEf", "#ffffff"),
    overlayBackgroundColor: normalizeHexColor(
      "#11223380",
      DEFAULT_CHAT_CONFIG.overlayBackgroundColor,
      true,
    ),
  };

  const parsed = parseChatConfigFromSearchParams(chatConfigToSearchParams(config));

  expect(parsed.size).toBe(2);
  expect(parsed.lineHeight).toBe(150);
  expect(parsed.emoteScale).toBe(1.35);
  expect(parsed.shadow).toBe(4);
  expect(parsed.stroke).toBe(false);
  expect(parsed.fade).toBe(7);
  expect(parsed.overlayBorderColor).toBe("#AbCdEf");
  expect(parsed.overlayBackgroundColor).toBe("#11223380");
});

test("the intOrFalse and secondsOrFalse url kinds parse identically", () => {
  // toPositiveIntOrFalse replaces two byte-identical helpers, so pin the
  // premise: the two URL kinds really are the same shape.
  const params = new URLSearchParams({ sh: "9", fd: "9" });
  const parsed = parseChatConfigFromSearchParams(params);
  expect(parsed.shadow).toBe(parsed.fade);

  const offParams = new URLSearchParams({ sh: "0", fd: "0" });
  const offParsed = parseChatConfigFromSearchParams(offParams);
  expect(offParsed.shadow).toBe(false);
  expect(offParsed.fade).toBe(false);
});
