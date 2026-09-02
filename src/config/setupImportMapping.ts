import type { ChatAnimationMode } from "./chatUrlParams";

export type SetupImportSource = "auto" | "chatis" | "cyan" | "davii";
export type DetectedSetupImportSource = Exclude<SetupImportSource, "auto">;

export type SetupImportPatch = {
  readonly channel?: string;
  readonly youtubeChannel?: string;
  readonly animation?: ChatAnimationMode;
  readonly bots?: boolean;
  readonly commands?: boolean;
  readonly hideSpecialBadges?: boolean;
  readonly showHomies?: boolean;
  readonly fade?: number | false;
  readonly size?: number;
  readonly font?: number;
  readonly fontWeight?: number;
  readonly fontCustom?: string;
  readonly stroke?: number | false;
  readonly shadow?: number | false;
  readonly emoteScale?: number;
  readonly smallCaps?: boolean;
  readonly nlAfterName?: boolean;
  readonly hideNames?: boolean;
  readonly botNames?: readonly string[];
  readonly reverseLineOrder?: boolean;
  readonly horizontal?: boolean;
  readonly singleChatter?: readonly string[];
  readonly show7tvUnlisted?: boolean;
  readonly showHighlightedMessages?: boolean;
  readonly showGigantifiedEmotes?: boolean;
  readonly showChannelPointRewards?: boolean;
};

export type SetupImportMapping = {
  readonly patch: SetupImportPatch;
  readonly unsupported: readonly string[];
};

export const CHATIS_UNIQUE_KEYS = [
  "hide_special_badges", "show_homies", "fontCustom", "nl_after_name",
  "hide_names", "botNames", "reverse_line_order", "horizontal",
  "single_chatter", "show_7tv_unlisted", "markdown", "md_image",
  "last_emote_background",
] as const;

export const SHARED_UNIQUE_KEYS = [
  "yt", "hide_commands", "hide_badges", "weight", "highlight", "gigantify",
  "show_redeems", "allow", "big_emotes", "link_urls", "center", "height",
  "hide_paints", "hide_colon",
] as const;

export const COMMON_KEYS = [
  "channel", "animate", "bots", "fade", "size", "font", "stroke", "shadow",
  "small_caps", "emoteScale",
] as const;

const CHATIS_UNSUPPORTED = [
  "markdown", "md_image", "last_emote_background",
] as const;
const SHARED_UNSUPPORTED = [
  "big_emotes", "link_urls", "center", "height", "hide_paints", "hide_colon",
  "sms", "invert", "block", "readable", "disable_sync", "disable_pruning",
  "yt_emotes", "voice", "highlight_mentions", "highlight_mention_color",
  "normal_chat", "streamer_chat", "off_commands", "scale", "pronouns",
] as const;
// Cyan font ids in query order. The first ten match ChatYX presets 1-10;
// the last two exist only in Cyan/Davii and become ChatYX custom fonts.
const CYAN_FONT_IDS = [
  "BalooTammudu", "SegoeUI", "Roboto", "Lato", "NotoSans", "SourceCodePro",
  "Impact", "Comfortaa", "DancingScript", "IndieFlower", "PressStart2P",
  "Wallpoet",
] as const;
const CYAN_ONLY_FONTS = [
  { id: "PressStart2P", family: "Press Start 2P" },
  { id: "Wallpoet", family: "Wallpoet" },
] as const;
// Cyan weight presets one..five; raw values from 100 up are CSS font-weights.
const CYAN_WEIGHT_PRESETS = [200, 400, 600, 800, 1000] as const;

function booleanValue(params: URLSearchParams, key: string): boolean | undefined {
  const value = params.get(key)?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function numberValue(params: URLSearchParams, key: string): number | undefined {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function indexedNumber(
  params: URLSearchParams,
  key: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const value = numberValue(params, key);
  return value !== undefined && Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : undefined;
}

function falseOrNonNegative(params: URLSearchParams, key: string): number | false | undefined {
  const value = numberValue(params, key);
  if (value === undefined || value < 0) return undefined;
  return value === 0 ? false : value;
}

// ChatIS drops out-of-range preset indices; 0 disables the effect.
function chatIsPreset(params: URLSearchParams, key: string, maximum: number): number | false | undefined {
  const value = numberValue(params, key);
  if (value === undefined || !Number.isInteger(value) || value < 0) return undefined;
  if (value === 0) return false;
  return value <= maximum ? value : undefined;
}

// Cyan clamps oversized preset indices to the strongest step; 0 disables.
function clampedPreset(params: URLSearchParams, key: string, maximum: number): number | false | undefined {
  const value = numberValue(params, key);
  if (value === undefined || !Number.isInteger(value) || value < 0) return undefined;
  if (value === 0) return false;
  return Math.min(value, maximum);
}

function normalizedText(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();
  return value ? value.replace(/^@/, "").toLowerCase() : undefined;
}

function normalizedList(params: URLSearchParams, key: string): readonly string[] | undefined {
  const raw = params.get(key);
  if (raw === null) return undefined;
  const values = raw.split(/[\s,]+/).map((value) => value.trim().replace(/^@/, "").toLowerCase()).filter(Boolean);
  return values.length > 0 ? [...new Set(values)] : undefined;
}

function unsupportedKeys(params: URLSearchParams, known: readonly string[]): readonly string[] {
  return known.filter((key) => params.has(key));
}

function cyanWeight(params: URLSearchParams): number | undefined {
  const value = numberValue(params, "weight");
  if (value === undefined || !Number.isInteger(value) || value <= 0) return undefined;
  if (value >= 100) return value;
  return CYAN_WEIGHT_PRESETS[Math.min(value, 5) - 1];
}

function cyanFontById(id: string): Pick<SetupImportPatch, "font" | "fontCustom"> {
  const lowered = id.toLowerCase();
  const cyanOnly = CYAN_ONLY_FONTS.find((font) => font.id.toLowerCase() === lowered);
  if (cyanOnly) return { font: 0, fontCustom: cyanOnly.family };
  const index = CYAN_FONT_IDS.findIndex((name) => name.toLowerCase() === lowered);
  return index >= 0 ? { font: index + 1 } : { font: 0, fontCustom: id };
}

function cyanFont(params: URLSearchParams): Pick<SetupImportPatch, "font" | "fontCustom"> {
  const raw = params.get("font")?.trim();
  if (!raw) return {};
  const numeric = Number.parseInt(raw, 10);
  if (Number.isInteger(numeric)) {
    if (numeric < 0 || numeric >= CYAN_FONT_IDS.length) return {};
    return cyanFontById(CYAN_FONT_IDS[numeric]);
  }
  return cyanFontById(raw);
}

export function mapChatIsParams(params: URLSearchParams): SetupImportMapping {
  const channel = normalizedText(params, "channel");
  const animate = booleanValue(params, "animate");
  const bots = booleanValue(params, "bots");
  const hideSpecialBadges = booleanValue(params, "hide_special_badges");
  const showHomies = booleanValue(params, "show_homies");
  const fade = falseOrNonNegative(params, "fade");
  const size = indexedNumber(params, "size", 1, 3);
  const font = indexedNumber(params, "font", 0, 12);
  const fontCustom = params.get("fontCustom")?.trim() || undefined;
  const stroke = chatIsPreset(params, "stroke", 4);
  const shadow = chatIsPreset(params, "shadow", 3);
  const emoteScale = numberValue(params, "emoteScale");
  const smallCaps = booleanValue(params, "small_caps");
  const nlAfterName = booleanValue(params, "nl_after_name");
  const hideNames = booleanValue(params, "hide_names");
  const botNames = normalizedList(params, "botNames");
  const reverseLineOrder = booleanValue(params, "reverse_line_order");
  const horizontal = booleanValue(params, "horizontal");
  const singleChatter = normalizedList(params, "single_chatter");
  const show7tvUnlisted = booleanValue(params, "show_7tv_unlisted");
  return {
    patch: {
      ...(channel !== undefined && { channel }),
      ...(animate !== undefined && { animation: animate ? "fade" : "none" }),
      ...(bots !== undefined && { bots }),
      ...(hideSpecialBadges !== undefined && { hideSpecialBadges }),
      ...(showHomies !== undefined && { showHomies }),
      ...(fade !== undefined && { fade }),
      ...(size !== undefined && { size }),
      ...(font !== undefined && { font }),
      ...(fontCustom !== undefined && { fontCustom }),
      ...(stroke !== undefined && { stroke }),
      ...(shadow !== undefined && { shadow }),
      ...(emoteScale !== undefined && { emoteScale }),
      ...(smallCaps !== undefined && { smallCaps }),
      ...(nlAfterName !== undefined && { nlAfterName }),
      ...(hideNames !== undefined && { hideNames }),
      ...(botNames !== undefined && { botNames }),
      ...(reverseLineOrder !== undefined && { reverseLineOrder }),
      ...(horizontal !== undefined && { horizontal }),
      ...(singleChatter !== undefined && { singleChatter }),
      ...(show7tvUnlisted !== undefined && { show7tvUnlisted }),
    },
    unsupported: unsupportedKeys(params, CHATIS_UNSUPPORTED),
  };
}

export function mapSharedParams(params: URLSearchParams): SetupImportMapping {
  const channel = normalizedText(params, "channel");
  const youtubeChannel = normalizedText(params, "yt");
  const animate = booleanValue(params, "animate");
  const bots = booleanValue(params, "bots");
  const hideCommands = booleanValue(params, "hide_commands");
  const hideBadges = booleanValue(params, "hide_badges");
  const fade = falseOrNonNegative(params, "fade");
  const size = indexedNumber(params, "size", 0, 3);
  const weight = cyanWeight(params);
  const stroke = clampedPreset(params, "stroke", 2);
  const shadow = clampedPreset(params, "shadow", 3);
  const smallCaps = booleanValue(params, "small_caps");
  const emoteScale = numberValue(params, "emoteScale");
  const highlight = booleanValue(params, "highlight");
  const gigantify = booleanValue(params, "gigantify");
  const showRedeems = booleanValue(params, "show_redeems");
  const allow = normalizedList(params, "allow");
  return {
    patch: {
      ...(channel !== undefined && { channel }),
      ...(youtubeChannel !== undefined && { youtubeChannel }),
      ...(animate !== undefined && { animation: animate ? "fade" : "none" }),
      ...(bots !== undefined && { bots }),
      ...(hideCommands !== undefined && { commands: !hideCommands }),
      ...(hideBadges !== undefined && { hideSpecialBadges: hideBadges }),
      ...(fade !== undefined && { fade }),
      ...(size !== undefined && { size: Math.max(1, size) }),
      ...cyanFont(params),
      ...(weight !== undefined && { fontWeight: weight }),
      ...(stroke !== undefined && { stroke }),
      ...(shadow !== undefined && { shadow }),
      ...(smallCaps !== undefined && { smallCaps }),
      ...(emoteScale !== undefined && { emoteScale }),
      ...(highlight !== undefined && { showHighlightedMessages: highlight }),
      ...(gigantify !== undefined && { showGigantifiedEmotes: gigantify }),
      ...(showRedeems !== undefined && { showChannelPointRewards: showRedeems }),
      ...(allow !== undefined && { singleChatter: allow }),
    },
    unsupported: unsupportedKeys(params, SHARED_UNSUPPORTED),
  };
}
