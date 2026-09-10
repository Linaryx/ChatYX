import { DEFAULT_BOT_NAMES } from "./botNames";
import {
  DEFAULT_MESSAGE_SPEED,
  clampMessageSpeed,
  normalizeChatAnimationMode,
  type ChatAnimationMode,
} from "../utils/ui/animationUtils";

export type { ChatAnimationMode } from "../utils/ui/animationUtils";

export type LinkDisplayMode = "normal" | "hide" | "highlight";
export type PlatformMarkerMode = "none" | "stripe" | "icon";

export interface ChatConfig {
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
  hideSpecialBadges: boolean;
  showHomies: boolean;
  recentMessages: boolean;
  fade: number | false; // seconds; false disables fade
  size: number;
  font: number;
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
  overlayBorderOpacity: number;
  highlightTwitchEvents: boolean;
  twitchEventColor: string;
  twitchEventBackgroundOpacity: number;
  twitchEventBold: boolean;
  twitchEventItalic: boolean;
  showHighlightedMessages: boolean;
  showChannelPointRewards: boolean;
  showGigantifiedEmotes: boolean;
  showPredictions: boolean;
  linkMode: LinkDisplayMode;
  linkColor: string;
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
  fontWeight: DEFAULT_FONT_WEIGHT,
  nickFontWeight: DEFAULT_FONT_WEIGHT,
  fontCustom: "",
  shadow: 1,
  stroke: false,
  fade: 60,
  animation: "fade",
  messageSpeed: DEFAULT_MESSAGE_SPEED,
  showHomies: true,
  recentMessages: true,
  bots: false,
  commands: true,
  hideSpecialBadges: false,
  emoteScale: 1,
  botNames: DEFAULT_BOT_NAMES.join(","),
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
  overlayBorderOpacity: 0,
  highlightTwitchEvents: true,
  twitchEventColor: "#9146ff",
  twitchEventBackgroundOpacity: 22,
  twitchEventBold: true,
  twitchEventItalic: false,
  showHighlightedMessages: true,
  showChannelPointRewards: true,
  showGigantifiedEmotes: true,
  showPredictions: false,
  linkMode: "normal",
  linkColor: "#53b7ff",
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
  recentMessages: {
    query: "rm",
    kind: "bool",
    aliases: ["recent_messages", "recentMessages"],
  },
  bots: { query: "b", kind: "bool", aliases: ["bots"] },
  commands: { query: "cmd", kind: "bool", aliases: ["commands"] },
  hideSpecialBadges: {
    query: "hsb",
    kind: "bool",
    aliases: ["hide_special_badges"],
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
  overlayBorderOpacity: {
    query: "bgb",
    kind: "int",
    aliases: ["overlay_border_opacity"],
  },
  highlightTwitchEvents: {
    query: "teh",
    kind: "bool",
    aliases: ["highlight_twitch_events"],
  },
  twitchEventColor: {
    query: "tec",
    kind: "string",
    aliases: ["twitch_event_color"],
  },
  twitchEventBackgroundOpacity: {
    query: "teo",
    kind: "int",
    aliases: ["twitch_event_background_opacity"],
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

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return null;
}

export const CHAT_CONFIG_QUERY_KEYS: readonly string[] = [
  ...Object.values(PARAMS).flatMap((def) => [def.query, ...(def.aliases ?? [])]),
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
        if (key.endsWith("Color") && !/^#?[0-9a-f]{6}$/i.test(raw)) return false;
      }
    }
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

  const botsDef = PARAMS.bots;
  const botNamesDef = PARAMS.botNames;
  const hasExplicitBotsParam = botsDef
    ? hasAnyParam(searchParams, [botsDef.query, ...(botsDef.aliases ?? [])])
    : false;
  const hasExplicitBotNamesParam = botNamesDef
    ? hasAnyParam(searchParams, [
        botNamesDef.query,
        ...(botNamesDef.aliases ?? []),
      ])
    : false;

  if (hasExplicitBotNamesParam && !hasExplicitBotsParam) {
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

  cfg.messageSpeed = clampMessageSpeed(cfg.messageSpeed);
  cfg.fontWeight = normalizeFontWeight(cfg.fontWeight);
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

  return params;
}

export function hasMultipleChatSources(
  config: Pick<ChatConfig, "channel" | "youtubeChannel" | "kickChannel">,
): boolean {
  return [config.channel, config.youtubeChannel, config.kickChannel]
    .filter((channel) => Boolean(channel.trim())).length > 1;
}
