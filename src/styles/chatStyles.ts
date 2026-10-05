import type { ChatConfig } from "~/config/chatUrlParams";
import { normalizeFontWeight } from "~/config/chatUrlParams";

// Size presets (v2 parity)
export const SIZE_CONFIGS = {
  1: {
    fontSize: "20px",
    lineHeight: "30px",
    badgeSize: 16,
    badgeMarginRight: "2px",
    badgeMarginBottom: "3px",
    badgeLastMarginRight: "3px",
    emoteMaxHeight: 25,
    emoteMaxWidth: "75px",
    emoteMarginRight: "-3px",
    cheerEmoteMaxHeight: 25,
    cheerEmoteMarginBottom: "-6px",
    upscaleHeight: 25,
    gigantifiedEmoteWidth: "180px",
    emojiHeight: 22,
    colonMarginRight: "8px",
    cheerBitsFontWeight: 700,
    cheerBitsMarginLeft: "2px",
    cheerBitsMarginRight: "4px",
  },
  2: {
    fontSize: "34px",
    lineHeight: "55px",
    badgeSize: 28,
    badgeMarginRight: "4px",
    badgeMarginBottom: "6px",
    badgeLastMarginRight: "6px",
    emoteMaxHeight: 42,
    emoteMaxWidth: "128px",
    emoteMarginRight: "-6px",
    cheerEmoteMaxHeight: 42,
    cheerEmoteMarginBottom: "-10px",
    upscaleHeight: 42,
    gigantifiedEmoteWidth: "240px",
    emojiHeight: 39,
    colonMarginRight: "14px",
    cheerBitsFontWeight: 600,
    cheerBitsMarginLeft: "4px",
    cheerBitsMarginRight: "7px",
  },
  3: {
    fontSize: "48px",
    lineHeight: "75px",
    badgeSize: 40,
    badgeMarginRight: "5px",
    badgeMarginBottom: "8px",
    badgeLastMarginRight: "8px",
    emoteMaxHeight: 60,
    emoteMaxWidth: "180px",
    emoteMarginRight: "-8px",
    cheerEmoteMaxHeight: 60,
    cheerEmoteMarginBottom: "-15px",
    upscaleHeight: 60,
    gigantifiedEmoteWidth: "300px",
    emojiHeight: 55,
    colonMarginRight: "20px",
    cheerBitsFontWeight: 500,
    cheerBitsMarginLeft: "5px",
    cheerBitsMarginRight: "10px",
  },
} as const;

/** Shadow filters by preset, indexed the way the config stores them. */
const SHADOW_FILTERS = {
  1: "drop-shadow(2px 2px 0.2rem black)",
  2: "drop-shadow(2px 2px 0.35rem black)",
  3: "drop-shadow(2px 2px 0.5rem black)",
} as const;

const STROKE_WIDTHS = {
  1: "1px",
  2: "2px",
  3: "3px",
  4: "4px",
} as const;

/** Line-height percentages outside this range are clamped, as they always were. */
const MIN_LINE_HEIGHT_PERCENT = 80;
const MAX_LINE_HEIGHT_PERCENT = 200;

/** The emote scale is clamped rather than rejected, as it always was. */
const MIN_EMOTE_SCALE = 0.25;
const MAX_EMOTE_SCALE = 3;

/**
 * Custom properties the overlay stylesheet consumes, derived from one config.
 *
 * `chat.css` owns every rule; this function only decides the values, the same way
 * `getChatEventStyleVariables` does for event colours. A property that is absent
 * falls back to the stylesheet's own default, which is how the disabled states
 * are expressed — so a shadow or stroke that is switched off simply publishes
 * nothing.
 *
 * The emote and emoji sizes fold in the user's emote scale, because a stylesheet
 * cannot multiply a preset by a runtime value.
 */
export function getOverlayStyleVariables(
  config: ChatConfig,
): Record<string, string> {
  const size =
    SIZE_CONFIGS[config.size as keyof typeof SIZE_CONFIGS] || SIZE_CONFIGS[2];
  const lineHeightPercent = Math.min(
    Math.max(config.lineHeight, MIN_LINE_HEIGHT_PERCENT),
    MAX_LINE_HEIGHT_PERCENT,
  );
  const emoteScale = Number.isFinite(config.emoteScale)
    ? Math.min(Math.max(config.emoteScale, MIN_EMOTE_SCALE), MAX_EMOTE_SCALE)
    : 1;
  const gigantifiedEmoteScale = Number.isFinite(config.gigantifiedEmoteScale)
    ? Math.min(Math.max(config.gigantifiedEmoteScale, MIN_EMOTE_SCALE), MAX_EMOTE_SCALE)
    : 1;

  const variables: Record<string, string> = {
    "--chat-size-font-size": size.fontSize,
    "--chat-line-height": `${
      (Number.parseInt(size.lineHeight, 10) * lineHeightPercent) / 100
    }px`,
    "--chat-font-weight": String(normalizeFontWeight(config.fontWeight)),
    "--chat-nick-font-weight": String(normalizeFontWeight(config.nickFontWeight)),
    "--chat-badge-size": `${size.badgeSize}px`,
    "--chat-badge-margin-right": size.badgeMarginRight,
    "--chat-badge-margin-bottom": size.badgeMarginBottom,
    "--chat-badge-last-margin-right": size.badgeLastMarginRight,
    "--chat-colon-margin-right": size.colonMarginRight,
    "--chat-cheer-bits-font-weight": String(size.cheerBitsFontWeight),
    "--chat-cheer-bits-margin-left": size.cheerBitsMarginLeft,
    "--chat-cheer-bits-margin-right": size.cheerBitsMarginRight,
    "--chat-cheer-emote-max-height": `${size.cheerEmoteMaxHeight}px`,
    "--chat-cheer-emote-margin-bottom": size.cheerEmoteMarginBottom,
    "--chat-emote-max-width": `${
      Number.parseFloat(size.emoteMaxWidth) * emoteScale
    }px`,
    "--chat-emote-max-height": `${size.emoteMaxHeight * emoteScale}px`,
    "--chat-emoji-size": `${size.emojiHeight * emoteScale}px`,
    "--chat-emote-margin-right": size.emoteMarginRight,
    "--chat-upscale-height": `${size.upscaleHeight}px`,
    "--chat-gigantified-emote-width": `${
      Number.parseFloat(size.gigantifiedEmoteWidth) * gigantifiedEmoteScale
    }px`,
    "--chat-gigantified-emote-max-size": size.gigantifiedEmoteWidth,
  };

  if (config.shadow) {
    variables["--chat-shadow-filter"] =
      SHADOW_FILTERS[config.shadow as keyof typeof SHADOW_FILTERS];
  }
  if (config.stroke) {
    variables["--chat-stroke"] =
      `${STROKE_WIDTHS[config.stroke as keyof typeof STROKE_WIDTHS]} black`;
    variables["--chat-paint-order"] = "stroke fill";
  }

  return variables;
}

/**
 * Every property `getOverlayStyleVariables` can publish, so a teardown can
 * remove all of them without re-deriving the config.
 * `tests/overlayStylesheet.test.ts` fails if this list and the function drift
 * apart.
 */
export const OVERLAY_STYLE_PROPERTIES = [
  "--chat-size-font-size",
  "--chat-line-height",
  "--chat-font-weight",
  "--chat-nick-font-weight",
  "--chat-badge-size",
  "--chat-badge-margin-right",
  "--chat-badge-margin-bottom",
  "--chat-badge-last-margin-right",
  "--chat-colon-margin-right",
  "--chat-cheer-bits-font-weight",
  "--chat-cheer-bits-margin-left",
  "--chat-cheer-bits-margin-right",
  "--chat-cheer-emote-max-height",
  "--chat-cheer-emote-margin-bottom",
  "--chat-emote-max-width",
  "--chat-emote-max-height",
  "--chat-emoji-size",
  "--chat-emote-margin-right",
  "--chat-upscale-height",
  "--chat-gigantified-emote-width",
  "--chat-gigantified-emote-max-size",
  "--chat-shadow-filter",
  "--chat-stroke",
  "--chat-paint-order",
] as const;

/**
 * Attributes the overlay stylesheet keys its boolean variants on, so those rules
 * stay static instead of being generated. `chat.css` spells them literally, and
 * `tests/overlayStylesheet.test.ts` fails if the two ever drift apart.
 */
export const OVERLAY_ATTRIBUTES = {
  /** Hides the author block (`.user_info`). */
  hideNames: "data-hide-names",
  /** Breaks the line after the author name (`.message::before`). */
  nlAfterName: "data-nl-after-name",
  /** Suppresses the container's own scrolling, for the embedded preview. */
  preview: "data-preview",
} as const;

export const FONTS = [
  "'Baloo Tammudu 2', cursive",
  "'Segoe UI', sans-serif",
  "'Roboto', sans-serif",
  "'Lato', sans-serif",
  "'Noto Sans JP', sans-serif",
  "'Source Code Pro', monospace",
  "'Impact', sans-serif",
  "'Comfortaa', cursive",
  "'Dancing Script', cursive",
  "'Indie Flower', cursive",
  "'Open Sans', sans-serif",
  "'AlsinaUltrajada', sans-serif",
  "'BF Mono', monospace",
] as const;

export const getFontFamily = (config: ChatConfig): string => {
  if (config.fontCustom) return config.fontCustom;
  return FONTS[config.font - 1] || FONTS[10];
};
