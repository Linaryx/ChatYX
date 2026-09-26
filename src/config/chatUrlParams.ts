import { DEFAULT_BOT_NAMES, DEFAULT_KICK_BOT_NAMES } from "./botNames";
import {
  DEFAULT_EVENT_COLORS,
  EVENT_COLOR_FIELDS,
  EVENT_COLOR_TOKENS,
  eventColorsMatchDefaults,
  normalizeEventColor,
  type EventColorConfig,
} from "./eventColors";
import {
  DEFAULT_MESSAGE_SPEED,
  clampMessageSpeed,
  normalizeChatAnimationMode,
  type ChatAnimationMode,
} from "../utils/ui/animationUtils";

export type { ChatAnimationMode } from "../utils/ui/animationUtils";

export type LinkDisplayMode = "normal" | "hide" | "highlight";
export type PlatformMarkerMode = "none" | "stripe" | "icon";

export interface ChatConfig extends EventColorConfig {
  // Required query param: `?c=...` (alias: `channel`)
  channel: string;
  youtubeChannel: string;
  youtubeWebSocketUrl: string;
  kickChannel: string;
  kickWebSocketUrl: string;
  platformMarker: PlatformMarkerMode;
  showGifs: boolean;
  gifScale: number;

  animation: ChatAnimationMode;
  messageSpeed: number;
  bots: boolean;
  commands: boolean;
  hideAllBadges: boolean;
  showTwitchBadges: boolean;
  showYouTubeBadges: boolean;
  showKickBadges: boolean;
  show7tvBadges: boolean;
  showFfzBadges: boolean;
  showBttvBadges: boolean;
  showHomies: boolean;
  showChatterinoBadges: boolean;
  showChatisBadges: boolean;
  recentMessages: boolean;
  fade: number | false; // seconds; false disables fade
  size: number;
  font: number;
  lineHeight: number;
  fontWeight: number;
  nickFontWeight: number;
  fontCustom: string;
  stroke: number | false;
  shadow: number | false;
  emoteScale: number;
  smallCaps: boolean;
  nlAfterName: boolean;
  hideNames: boolean;
  botNames: string;
  kickBotNames: string;
  reverseLineOrder: boolean;
  horizontal: boolean;
  singleChatter: string;
  show7tvUnlisted: boolean;
  ffzBotMix: number; // legacy / fallback
  ffzBotMixCustom: boolean;
  ffzBotMixBroadcaster: boolean;
  ffzBotMixModerator: boolean;
  ffzBotMixVip: boolean;
  overlayBackgroundColor: string;
  overlayBackgroundOpacity: number;
  overlayBackgroundRadius: number;
  overlayPadding: number;
  overlayBorderWidth: number;
  overlayBorderColor: string;
  highlightTwitchEvents: boolean;
  eventColorOpacity: number;
  twitchEventBold: boolean;
  twitchEventItalic: boolean;
  showHighlightedMessages: boolean;
  showChannelPointRewards: boolean;
  showGigantifiedEmotes: boolean;
  showPredictions: boolean;
  linkMode: LinkDisplayMode;
  linkColor: string;
  usersColor: string;
  hideLinkRewards: boolean;
  rteProxy: boolean;
  rteAzureTts: boolean;
  rteChatIsTts: boolean;
  rteReyohohoBadge: boolean;
  rteCustomCosmetics: boolean;
  ttsReadChat: boolean;
  ttsReadBots: boolean;
  ttsVoice: string;
  ttsChatIsVoice: string;
  ttsVolume: number;
  ttsMaxLength: number;
}

export const DEFAULT_FONT_WEIGHT = 800;
export const DEFAULT_RECENT_MESSAGE_LIMIT = 15;

export const DEFAULT_CHAT_CONFIG: Readonly<ChatConfig> = Object.freeze({
  channel: "",
  youtubeChannel: "",
  youtubeWebSocketUrl: "wss://ytwss.ruina.team",
  kickChannel: "",
  kickWebSocketUrl: "wss://ytwss.ruina.team",
  platformMarker: "stripe",
  showGifs: false,
  gifScale: 1,
  size: 1,
  font: 2,
  lineHeight: 100,
  fontWeight: DEFAULT_FONT_WEIGHT,
  nickFontWeight: DEFAULT_FONT_WEIGHT,
  fontCustom: "",
  shadow: 1,
  stroke: false,
  fade: 60,
  animation: "fade",
  messageSpeed: DEFAULT_MESSAGE_SPEED,
  showHomies: true,
  show7tvBadges: true,
  showFfzBadges: true,
  showBttvBadges: true,
  showChatterinoBadges: true,
  showChatisBadges: true,
  showTwitchBadges: true,
  showYouTubeBadges: true,
  showKickBadges: true,
  recentMessages: true,
  bots: false,
  commands: true,
  hideAllBadges: false,
  emoteScale: 1,
  botNames: DEFAULT_BOT_NAMES.join(","),
  kickBotNames: DEFAULT_KICK_BOT_NAMES.join(","),
  singleChatter: "",
  show7tvUnlisted: true,
  smallCaps: false,
  nlAfterName: false,
  hideNames: false,
  reverseLineOrder: false,
  horizontal: false,
  ffzBotMix: 1,
  ffzBotMixCustom: true,
  ffzBotMixBroadcaster: false,
  ffzBotMixModerator: true,
  ffzBotMixVip: false,
  overlayBackgroundColor: "#000000",
  overlayBackgroundOpacity: 50,
  overlayBackgroundRadius: 20,
  overlayPadding: 10,
  overlayBorderWidth: 0,
  overlayBorderColor: "#ffffff",
  highlightTwitchEvents: true,
  eventColorOpacity: 22,
  ...DEFAULT_EVENT_COLORS,
  twitchEventBold: true,
  twitchEventItalic: false,
  showHighlightedMessages: true,
  showChannelPointRewards: true,
  showGigantifiedEmotes: true,
  showPredictions: false,
  linkMode: "normal",
  linkColor: "#53b7ff",
  usersColor: "",
  hideLinkRewards: true,
  rteProxy: false,
  rteAzureTts: true,
  rteChatIsTts: true,
  rteReyohohoBadge: true,
  rteCustomCosmetics: true,
  ttsReadChat: false,
  ttsReadBots: false,
  ttsVoice: "Dmitry",
  ttsChatIsVoice: "Maxim",
  ttsVolume: 1,
  ttsMaxLength: 400,
});

export function normalizeFontWeight(
  value: number | undefined,
  fallback = DEFAULT_FONT_WEIGHT,
): number {
  const numeric = Number(value);
  const resolved = Number.isFinite(numeric) ? numeric : fallback;
  return Math.min(Math.max(Math.round(resolved), 100), 1000);
}

export function normalizeLineHeight(value: number | undefined): number {
  const numeric = Number(value);
  const resolved = Number.isFinite(numeric) ? numeric : DEFAULT_CHAT_CONFIG.lineHeight;
  return Math.min(Math.max(Math.round(resolved), 80), 200);
}

export function parseBotNames(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeBotNames(raw: string): string {
  return parseBotNames(raw).join(",");
}

type ParamKind =
  | "bool"
  | "int"
  | "float"
  | "string"
  | "intOrFalse"
  | "secondsOrFalse";

type ParamDef<K extends keyof ChatConfig> = {
  query: string;
  kind: ParamKind;
  aliases?: string[];
  serialize?: (value: ChatConfig[K], cfg: ChatConfig) => string | null;
};

const PARAMS: { [K in keyof ChatConfig]?: ParamDef<K> } = {
  channel: { query: "c", kind: "string", aliases: ["channel"] },
  youtubeChannel: {
    query: "yt",
    kind: "string",
    aliases: ["youtube", "youtube_channel", "youtubeChannel"],
    serialize: (value) => {
      const normalized = String(value || "").trim().replace(/^@/, "");
      return normalized || null;
    },
  },
  youtubeWebSocketUrl: {
    query: "ytws",
    kind: "string",
    aliases: ["youtube_ws", "youtubeWebSocketUrl"],
    serialize: (value) => {
      const normalized = String(value || "").trim().replace(/\/+$/, "");
      return normalized || null;
    },
  },
  kickChannel: {
    query: "kick",
    kind: "string",
    aliases: ["kick_channel", "kickChannel"],
    serialize: (value) => {
      const normalized = String(value || "").trim().replace(/^@/, "");
      return normalized || null;
    },
  },
  kickWebSocketUrl: {
    query: "kickws",
    kind: "string",
    aliases: ["kick_ws", "kickWebSocketUrl"],
    serialize: (value) => {
      const normalized = String(value || "").trim().replace(/\/+$/, "");
      return normalized || null;
    },
  },
  platformMarker: {
    query: "pm",
    kind: "string",
    aliases: ["platform_marker", "platformMarker"],
  },
  showGifs: { query: "gifs", kind: "bool", aliases: ["show_gifs", "showGifs"] },
  gifScale: { query: "gifscale", kind: "float", aliases: ["gif_scale", "gifScale"] },

  size: { query: "s", kind: "int", aliases: ["size"] },
  font: { query: "f", kind: "int", aliases: ["font"] },
  lineHeight: { query: "lh", kind: "int", aliases: ["line_height", "lineHeight"] },
  fontWeight: {
    query: "fw",
    kind: "int",
    aliases: ["font_weight", "fontWeight"],
    serialize: (value) => String(normalizeFontWeight(Number(value))),
  },
  nickFontWeight: {
    query: "nfw",
    kind: "int",
    aliases: ["nick_font_weight", "nickFontWeight"],
    serialize: (value) => String(normalizeFontWeight(Number(value))),
  },
  fontCustom: {
    query: "fc",
    kind: "string",
    aliases: ["fontCustom"],
    // Only meaningful when font=0 (custom font)
    serialize: (value, cfg) => (cfg.font === 0 && value ? String(value) : null),
  },
  shadow: { query: "sh", kind: "intOrFalse", aliases: ["shadow"] },
  stroke: { query: "st", kind: "intOrFalse", aliases: ["stroke"] },
  fade: { query: "fd", kind: "secondsOrFalse", aliases: ["fade"] },
  animation: { query: "an", kind: "string", aliases: ["animation"] },
  messageSpeed: {
    query: "ms",
    kind: "int",
    aliases: ["message_speed", "messageSpeed"],
  },
  showHomies: { query: "hm", kind: "bool", aliases: ["show_homies"] },
  showTwitchBadges: { query: "twb", kind: "bool", aliases: ["show_twitch_badges", "showTwitchBadges"] },
  showYouTubeBadges: { query: "ytb", kind: "bool", aliases: ["show_youtube_badges", "showYouTubeBadges"] },
  showKickBadges: { query: "kcb", kind: "bool", aliases: ["show_kick_badges", "showKickBadges"] },
  show7tvBadges: { query: "s7b", kind: "bool", aliases: ["show_7tv_badges", "show7tvBadges"] },
  showFfzBadges: { query: "ffzb", kind: "bool", aliases: ["show_ffz_badges", "showFfzBadges"] },
  showBttvBadges: { query: "bttvb", kind: "bool", aliases: ["show_bttv_badges", "showBttvBadges"] },
  showChatterinoBadges: { query: "chb", kind: "bool", aliases: ["show_chatterino_badges", "showChatterinoBadges"] },
  showChatisBadges: { query: "cidb", kind: "bool", aliases: ["show_chatis_badges", "showChatisBadges"] },
  recentMessages: {
    query: "rm",
    kind: "bool",
    aliases: ["recent_messages", "recentMessages"],
  },
  bots: { query: "b", kind: "bool", aliases: ["bots"] },
  commands: { query: "cmd", kind: "bool", aliases: ["commands"] },
  hideAllBadges: {
    query: "hab",
    kind: "bool",
    aliases: ["hide_all_badges", "hideAllBadges"],
  },
  emoteScale: { query: "es", kind: "float", aliases: ["emoteScale"] },
  botNames: {
    query: "bn",
    kind: "string",
    aliases: ["botNames"],
    serialize: (value) => {
      const normalized = normalizeBotNames(String(value || ""));
      return normalized || null;
    },
  },
  kickBotNames: {
    query: "kbn",
    kind: "string",
    aliases: ["kick_bot_names", "kickBotNames"],
    serialize: (value) => {
      const normalized = normalizeBotNames(String(value || ""));
      return normalized || null;
    },
  },
  singleChatter: { query: "sg", kind: "string", aliases: ["single_chatter"] },
  show7tvUnlisted: {
    query: "u7",
    kind: "bool",
    aliases: ["show_7tv_unlisted"],
  },
  smallCaps: { query: "sc", kind: "bool", aliases: ["small_caps"] },
  nlAfterName: { query: "nl", kind: "bool", aliases: ["nl_after_name"] },
  hideNames: { query: "hn", kind: "bool", aliases: ["hide_names"] },
  reverseLineOrder: {
    query: "rl",
    kind: "bool",
    aliases: ["reverse_line_order"],
  },
  horizontal: { query: "hr", kind: "bool", aliases: ["horizontal"] },
  ffzBotMix: { query: "fm", kind: "int", aliases: ["ffz_bot_mix"] },
  ffzBotMixCustom: {
    query: "fmc",
    kind: "bool",
    aliases: ["ffz_bot_mix_custom"],
  },
  ffzBotMixBroadcaster: {
    query: "fmb",
    kind: "bool",
    aliases: ["ffz_bot_mix_broadcaster"],
  },
  ffzBotMixModerator: {
    query: "fmm",
    kind: "bool",
    aliases: ["ffz_bot_mix_moderator"],
  },
  ffzBotMixVip: {
    query: "fmv",
    kind: "bool",
    aliases: ["ffz_bot_mix_vip"],
  },
  overlayBackgroundColor: {
    query: "bgc",
    kind: "string",
    aliases: ["overlay_background_color"],
  },
  overlayBackgroundOpacity: {
    query: "bgo",
    kind: "int",
    aliases: ["overlay_background_opacity"],
  },
  overlayBackgroundRadius: {
    query: "bgr",
    kind: "int",
    aliases: ["overlay_background_radius"],
  },
  overlayPadding: {
    query: "bgp",
    kind: "int",
    aliases: ["overlay_padding", "overlayPadding"],
  },
  overlayBorderWidth: {
    query: "bgw",
    kind: "int",
    aliases: ["overlay_border_width", "bgb", "overlay_border_opacity"],
  },
  overlayBorderColor: {
    query: "bcl",
    kind: "string",
    aliases: ["overlay_border_color"],
  },
  highlightTwitchEvents: {
    query: "teh",
    kind: "bool",
    aliases: ["highlight_twitch_events"],
  },
  twitchEventBold: {
    query: "teb",
    kind: "bool",
    aliases: ["twitch_event_bold"],
  },
  twitchEventItalic: {
    query: "tei",
    kind: "bool",
    aliases: ["twitch_event_italic"],
  },
  showHighlightedMessages: {
    query: "hl",
    kind: "bool",
    aliases: ["show_highlighted_messages"],
  },
  showChannelPointRewards: {
    query: "rewards",
    kind: "bool",
    aliases: ["show_redeems"],
  },
  showGigantifiedEmotes: {
    query: "gigantify",
    kind: "bool",
    aliases: ["show_gigantified_emotes"],
  },
  showPredictions: {
    query: "pred",
    kind: "bool",
    aliases: ["predictions", "show_predictions"],
  },
  linkMode: {
    query: "links",
    kind: "string",
    aliases: ["link_mode"],
  },
  linkColor: {
    query: "linkcolor",
    kind: "string",
    aliases: ["link_color"],
  },
  usersColor: {
    query: "userscolor",
    kind: "string",
    aliases: ["users_color", "usersColor"],
  },
  hideLinkRewards: {
    query: "hidelinkrewards",
    kind: "bool",
    aliases: ["hide_link_rewards"],
  },
  rteProxy: {
    query: "rtep",
    kind: "bool",
    aliases: ["rte_proxy", "rteProxy"],
  },
  rteAzureTts: {
    query: "aztts",
    kind: "bool",
    aliases: ["rte_azure_tts", "rteAzureTts"],
  },
  rteChatIsTts: {
    query: "rtetts",
    kind: "bool",
    aliases: ["rte_chatis_tts", "rteChatIsTts", "chatis_tts"],
  },
  rteReyohohoBadge: {
    query: "rtebadge",
    kind: "bool",
    aliases: ["rte_reyohoho_badge", "rteReyohohoBadge"],
  },
  rteCustomCosmetics: {
    query: "rtecosmetics",
    kind: "bool",
    aliases: ["rte_custom_cosmetics", "rteCustomCosmetics"],
  },
  ttsReadChat: {
    query: "ttsread",
    kind: "bool",
    aliases: ["tts_read_chat", "ttsReadChat"],
  },
  ttsReadBots: {
    query: "ttsbots",
    kind: "bool",
    aliases: ["tts_read_bots", "ttsReadBots"],
  },
  ttsVoice: {
    query: "ttsvoice",
    kind: "string",
    aliases: ["tts_voice", "ttsVoice"],
  },
  ttsChatIsVoice: {
    query: "ttschatisvoice",
    kind: "string",
    aliases: ["tts_chatis_voice", "ttsChatIsVoice"],
  },
  ttsVolume: {
    query: "ttsvolume",
    kind: "float",
    aliases: ["tts_volume", "ttsVolume"],
  },
  ttsMaxLength: {
    query: "ttsmax",
    kind: "int",
    aliases: ["tts_max_length", "ttsMaxLength"],
  },
};

export const BADGE_PROVIDER_SETTINGS = [
  { field: "show7tvBadges", token: "7tv" },
  { field: "showFfzBadges", token: "ffz" },
  { field: "showBttvBadges", token: "bttv" },
  { field: "showHomies", token: "homies" },
  { field: "showChatterinoBadges", token: "chatterino" },
  { field: "showChatisBadges", token: "chatis" },
  { field: "showTwitchBadges", token: "twitch" },
  { field: "showYouTubeBadges", token: "youtube" },
  { field: "showKickBadges", token: "kick" },
] as const satisfies ReadonlyArray<{
  field: keyof ChatConfig;
  token: string;
}>;

const PLATFORM_BADGE_TOKENS = new Set(["twitch", "youtube", "kick"]);
export const THIRD_PARTY_BADGE_FIELDS = BADGE_PROVIDER_SETTINGS.filter(
  (provider) => !PLATFORM_BADGE_TOKENS.has(provider.token),
).map((provider) => provider.field) as ReadonlyArray<keyof ChatConfig>;

export const BADGES_HIDDEN_PARAM = {
  query: "nobadge",
  aliases: ["hidden_badges", "hiddenBadges"],
} as const;

const EVENT_COLORS_PARAM = {
  query: "evc",
  aliases: ["event_colors"],
} as const;

const EVENT_OPACITY_PARAM = {
  query: "eva",
  aliases: ["event_opacity"],
} as const;

const LEGACY_EVENT_COLOR_PARAMS = {
  color: ["tec", "twitch_event_color"],
  opacity: ["teo", "twitch_event_background_opacity"],
} as const;

function parseEventColors(raw: string): EventColorConfig | null {
  const values = raw.split(",");
  const colors = { ...DEFAULT_EVENT_COLORS };
  if (values.every((value) => value.includes(":"))) {
    const fieldsByToken = new Map(
      EVENT_COLOR_FIELDS.map((field) => [EVENT_COLOR_TOKENS[field], field]),
    );
    for (const value of values) {
      const [token, color] = value.split(":", 2);
      const field = token ? fieldsByToken.get(token) : undefined;
      const normalized = normalizeEventColor(color ?? "", "");
      if (!field || !normalized) return null;
      colors[field] = normalized;
    }
    return colors;
  }

  if (values.length !== EVENT_COLOR_FIELDS.length) return null;
  for (const [index, field] of EVENT_COLOR_FIELDS.entries()) {
    const normalized = normalizeEventColor(values[index] ?? "", "");
    if (!normalized) return null;
    colors[field] = normalized;
  }
  return colors;
}

function serializeEventColors(cfg: EventColorConfig): string | null {
  if (eventColorsMatchDefaults(cfg)) return null;
  return EVENT_COLOR_FIELDS.flatMap((field) => {
    const color = normalizeEventColor(cfg[field], DEFAULT_EVENT_COLORS[field]);
    return color === DEFAULT_EVENT_COLORS[field]
      ? []
      : [`${EVENT_COLOR_TOKENS[field]}:${color.slice(1)}`];
  }).join(",");
}

export function parseHiddenBadgeProviders(
  searchParams: URLSearchParams,
): ReadonlyArray<keyof ChatConfig> {
  const raw = getFirstParam(searchParams, [
    BADGES_HIDDEN_PARAM.query,
    ...BADGES_HIDDEN_PARAM.aliases,
  ]);
  if (raw === null) return [];

  return raw
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .map((token) =>
      BADGE_PROVIDER_SETTINGS.find((provider) => provider.token === token),
    )
    .filter((provider): provider is (typeof BADGE_PROVIDER_SETTINGS)[number] =>
      Boolean(provider),
    )
    .map((provider) => provider.field);
}

export function serializeHiddenBadgeProviders(cfg: ChatConfig): string | null {
  const hidden = BADGE_PROVIDER_SETTINGS.filter(
    (provider) => cfg[provider.field] === false,
  ).map((provider) => provider.token);
  return hidden.length > 0 ? hidden.join(",") : null;
}

export function hideAllThirdPartyBadgesPatch(): Readonly<Pick<ChatConfig,
  | "show7tvBadges"
  | "showFfzBadges"
  | "showBttvBadges"
  | "showHomies"
  | "showChatterinoBadges"
  | "showChatisBadges"
>> {
  return {
    show7tvBadges: false,
    showFfzBadges: false,
    showBttvBadges: false,
    showHomies: false,
    showChatterinoBadges: false,
    showChatisBadges: false,
  };
}

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return null;
}

export const CHAT_CONFIG_QUERY_KEYS: readonly string[] = [
  ...Object.values(PARAMS).flatMap((def) => [def.query, ...(def.aliases ?? [])]),
  BADGES_HIDDEN_PARAM.query,
  ...BADGES_HIDDEN_PARAM.aliases,
  EVENT_COLORS_PARAM.query,
  ...EVENT_COLORS_PARAM.aliases,
  EVENT_OPACITY_PARAM.query,
  ...EVENT_OPACITY_PARAM.aliases,
  ...LEGACY_EVENT_COLOR_PARAMS.color,
  ...LEGACY_EVENT_COLOR_PARAMS.opacity,
  "a", "animate",
];

// Import must not turn a typo into a full reset via the runtime parser's fallbacks.
export function isValidChatConfigImport(params: URLSearchParams): boolean {
  if (!CHAT_CONFIG_QUERY_KEYS.some((key) => params.has(key))) return false;
  for (const [key, def] of Object.entries(PARAMS)) {
    for (const query of [def.query, ...(def.aliases ?? [])]) {
      for (const raw of params.getAll(query)) {
        if (def.kind === "bool" && parseBool(raw) === null) return false;
        if (def.kind !== "bool" && def.kind !== "string") {
          if (!raw.trim() || !Number.isFinite(Number(raw))) return false;
          const numericPattern = def.kind === "float"
            ? /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i
            : /^[+-]?\d+$/;
          if (!numericPattern.test(raw.trim())) return false;
        }
        if (key === "animation" && normalizeChatAnimationMode(raw) !== raw) return false;
        if (key === "linkMode" && !["normal", "hide", "highlight"].includes(raw)) return false;
        if (key === "platformMarker" && !["none", "stripe", "icon"].includes(raw)) return false;
        if (key === "overlayBorderColor" && !/^#?[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(raw)) return false;
        if (key !== "overlayBorderColor" && key.endsWith("Color") && !/^#?[0-9a-f]{6}$/i.test(raw)) return false;
      }
    }
  }
  for (const query of [BADGES_HIDDEN_PARAM.query, ...BADGES_HIDDEN_PARAM.aliases]) {
    for (const raw of params.getAll(query)) {
      if (!raw.trim()) return false;
      const tokens = raw.split(",").map((token) => token.trim().toLowerCase());
      if (tokens.some((token) => !BADGE_PROVIDER_SETTINGS.some((provider) => provider.token === token))) {
        return false;
      }
    }
  }
  for (const query of [EVENT_COLORS_PARAM.query, ...EVENT_COLORS_PARAM.aliases]) {
    if (params.getAll(query).some((raw) => parseEventColors(raw) === null)) return false;
  }
  for (const query of [EVENT_OPACITY_PARAM.query, ...EVENT_OPACITY_PARAM.aliases]) {
    if (params.getAll(query).some((raw) => !/^\d+$/.test(raw))) return false;
  }
  for (const query of LEGACY_EVENT_COLOR_PARAMS.color) {
    if (params.getAll(query).some((raw) => !/^#?[0-9a-f]{6}$/i.test(raw))) return false;
  }
  for (const query of LEGACY_EVENT_COLOR_PARAMS.opacity) {
    if (params.getAll(query).some((raw) => !/^\d+$/.test(raw))) return false;
  }
  return ["a", "animate"].every((key) =>
    params.getAll(key).every((raw) => parseBool(raw) !== null),
  );
}

function parseIntSafe(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseRecentMessageLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get("rmlimit");
  if (raw === null) return DEFAULT_RECENT_MESSAGE_LIMIT;

  const parsed = parseIntSafe(raw);
  if (parsed === null) return DEFAULT_RECENT_MESSAGE_LIMIT;
  return Math.min(Math.max(parsed, 1), 100);
}

function parseFloatSafe(raw: string): number | null {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function getFirstParam(
  searchParams: URLSearchParams,
  keys: string[],
): string | null {
  for (const key of keys) {
    const v = searchParams.get(key);
    if (v !== null) return v;
  }
  return null;
}

function hasAnyParam(searchParams: URLSearchParams, keys: string[]): boolean {
  return keys.some((key) => searchParams.has(key));
}

export function parseChatConfigFromSearchParams(
  searchParams: URLSearchParams,
  opts?: { channel?: string },
): ChatConfig {
  const channelDef = PARAMS.channel;
  const channelParam = channelDef
    ? getFirstParam(searchParams, [
        channelDef.query,
        ...(channelDef.aliases ?? []),
      ])
    : null;
  const cfg: ChatConfig = {
    ...DEFAULT_CHAT_CONFIG,
    channel: opts?.channel ?? channelParam ?? "",
  };

  // Apply params with a small "case" dispatcher (no giant if-chains).
  for (const [key, def] of Object.entries(PARAMS) as Array<
    [keyof ChatConfig, ParamDef<keyof ChatConfig>]
  >) {
    const raw = getFirstParam(searchParams, [
      def.query,
      ...(def.aliases ?? []),
    ]);
    if (raw === null) continue;

    switch (def.kind) {
      case "bool": {
        const parsed = parseBool(raw);
        if (parsed !== null) (cfg as any)[key] = parsed;
        break;
      }
      case "int": {
        const parsed = parseIntSafe(raw);
        if (parsed !== null) (cfg as any)[key] = parsed;
        break;
      }
      case "float": {
        const parsed = parseFloatSafe(raw);
        if (parsed !== null) (cfg as any)[key] = parsed;
        break;
      }
      case "string": {
        (cfg as any)[key] = raw;
        break;
      }
      case "intOrFalse": {
        const parsed = parseIntSafe(raw);
        if (parsed === null) break;
        (cfg as any)[key] = parsed <= 0 ? false : parsed;
        break;
      }
      case "secondsOrFalse": {
        const parsed = parseIntSafe(raw);
        if (parsed === null) break;
        (cfg as any)[key] = parsed <= 0 ? false : parsed;
        break;
      }
    }
  }

  const eventColors = getFirstParam(searchParams, [
    EVENT_COLORS_PARAM.query,
    ...EVENT_COLORS_PARAM.aliases,
  ]);
  const parsedEventColors = eventColors === null ? null : parseEventColors(eventColors);
  if (parsedEventColors) {
    Object.assign(cfg, parsedEventColors);
  } else if (eventColors === null) {
    const legacyColor = getFirstParam(searchParams, [...LEGACY_EVENT_COLOR_PARAMS.color]);
    const legacyOpacity = getFirstParam(searchParams, [...LEGACY_EVENT_COLOR_PARAMS.opacity]);
    if (legacyColor !== null || legacyOpacity !== null) {
      const color = normalizeEventColor(
        legacyColor ?? DEFAULT_EVENT_COLORS.eventColorDefault,
        DEFAULT_EVENT_COLORS.eventColorDefault,
      );
      for (const field of EVENT_COLOR_FIELDS) {
        cfg[field] = color;
      }
      cfg.eventColorOpacity = legacyOpacity === null
        ? 22
        : Math.min(Math.max(parseIntSafe(legacyOpacity) ?? 22, 0), 100);
    }
  }

  const eventOpacity = getFirstParam(searchParams, [
    EVENT_OPACITY_PARAM.query,
    ...EVENT_OPACITY_PARAM.aliases,
  ]);
  if (eventOpacity !== null) {
    cfg.eventColorOpacity = Math.min(Math.max(parseIntSafe(eventOpacity) ?? 22, 0), 100);
  }

  const botsDef = PARAMS.bots;
  const botNamesDef = PARAMS.botNames;
  const kickBotNamesDef = PARAMS.kickBotNames;
  const hasExplicitBotsParam = botsDef
    ? hasAnyParam(searchParams, [botsDef.query, ...(botsDef.aliases ?? [])])
    : false;
  const hasExplicitBotNamesParam = botNamesDef
    ? hasAnyParam(searchParams, [
        botNamesDef.query,
        ...(botNamesDef.aliases ?? []),
      ])
    : false;
  const hasExplicitKickBotNamesParam = kickBotNamesDef
    ? hasAnyParam(searchParams, [
        kickBotNamesDef.query,
        ...(kickBotNamesDef.aliases ?? []),
      ])
    : false;

  if ((hasExplicitBotNamesParam || hasExplicitKickBotNamesParam) && !hasExplicitBotsParam) {
    cfg.bots = false;
  }

  const animationDef = PARAMS.animation;
  const hasExplicitAnimationParam = animationDef
    ? hasAnyParam(searchParams, [
        animationDef.query,
        ...(animationDef.aliases ?? []),
      ])
    : false;
  if (!hasExplicitAnimationParam) {
    const legacyAnimate = getFirstParam(searchParams, ["a", "animate"]);
    const parsedLegacyAnimate = legacyAnimate === null ? null : parseBool(legacyAnimate);
    if (parsedLegacyAnimate !== null) {
      cfg.animation = parsedLegacyAnimate ? "fade" : "none";
    }
  }

  for (const field of parseHiddenBadgeProviders(searchParams)) {
    (cfg as any)[field] = false;
  }

  // Legacy `hsb`/`hide_special_badges` hid every third-party badge provider.
  const legacyHideSpecial = getFirstParam(searchParams, ["hsb", "hide_special_badges"]);
  if (legacyHideSpecial !== null && parseBool(legacyHideSpecial) === true) {
    for (const field of THIRD_PARTY_BADGE_FIELDS) {
      (cfg as any)[field] = false;
    }
  }

  cfg.messageSpeed = clampMessageSpeed(cfg.messageSpeed);
  cfg.fontWeight = normalizeFontWeight(cfg.fontWeight);
  cfg.lineHeight = normalizeLineHeight(cfg.lineHeight);
  cfg.nickFontWeight = normalizeFontWeight(cfg.nickFontWeight);
  cfg.animation = normalizeChatAnimationMode(cfg.animation);
  cfg.ttsVolume = Math.min(Math.max(cfg.ttsVolume, 0), 1);
  cfg.ttsMaxLength = Math.max(cfg.ttsMaxLength, 1);
  cfg.gifScale = Math.min(Math.max(cfg.gifScale, 0.25), 3);
  if (!["normal", "hide", "highlight"].includes(cfg.linkMode)) {
    cfg.linkMode = DEFAULT_CHAT_CONFIG.linkMode;
  }
  if (!["none", "stripe", "icon"].includes(cfg.platformMarker)) {
    cfg.platformMarker = DEFAULT_CHAT_CONFIG.platformMarker;
  }

  return cfg;
}

export function chatConfigToSearchParams(cfg: ChatConfig): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, def] of Object.entries(PARAMS) as Array<
    [keyof ChatConfig, ParamDef<keyof ChatConfig>]
  >) {
    const value = cfg[key];
    const defaultValue = DEFAULT_CHAT_CONFIG[key];

    // Omit default values (keeps URLs clean).
    if (Object.is(value, defaultValue)) continue;

    const custom = def.serialize?.(value as any, cfg);
    if (custom === null) continue;
    if (typeof custom === "string") {
      params.set(def.query, custom);
      continue;
    }

    switch (def.kind) {
      case "bool":
        params.set(def.query, value ? "true" : "false");
        break;
      case "int":
      case "float":
      case "string":
        params.set(def.query, String(value));
        break;
      case "intOrFalse":
      case "secondsOrFalse":
        params.set(def.query, value === false ? "0" : String(value));
        break;
    }
  }

  const hiddenProviders = serializeHiddenBadgeProviders(cfg);
  if (hiddenProviders !== null) {
    params.set(BADGES_HIDDEN_PARAM.query, hiddenProviders);
  }

  if (cfg.highlightTwitchEvents) {
    const eventColors = serializeEventColors(cfg);
    if (eventColors !== null) params.set(EVENT_COLORS_PARAM.query, eventColors);
    if (cfg.eventColorOpacity !== DEFAULT_CHAT_CONFIG.eventColorOpacity) {
      params.set(EVENT_OPACITY_PARAM.query, String(Math.min(Math.max(cfg.eventColorOpacity, 0), 100)));
    }
  }

  return params;
}

export function hasMultipleChatSources(
  config: Pick<ChatConfig, "channel" | "youtubeChannel" | "kickChannel">,
): boolean {
  return [config.channel, config.youtubeChannel, config.kickChannel]
    .filter((channel) => Boolean(channel.trim())).length > 1;
}
