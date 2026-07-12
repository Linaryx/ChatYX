import { DEFAULT_BOT_NAMES } from "./botNames";
import {
  DEFAULT_MESSAGE_SPEED,
  clampMessageSpeed,
} from "../utils/ui/animationUtils";

export interface ChatConfig {
  // Required query param: `?c=...` (alias: `channel`)
  channel: string;
  youtubeChannel: string;
  youtubeWebSocketUrl: string;

  animate: boolean;
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
  overlayBorderOpacity: number;
}

export const DEFAULT_FONT_WEIGHT = 800;

export const DEFAULT_CHAT_CONFIG: Readonly<ChatConfig> = Object.freeze({
  channel: "",
  youtubeChannel: "",
  youtubeWebSocketUrl: "",
  size: 1,
  font: 2,
  fontWeight: DEFAULT_FONT_WEIGHT,
  nickFontWeight: DEFAULT_FONT_WEIGHT,
  fontCustom: "",
  shadow: 1,
  stroke: false,
  fade: 60,
  animate: true,
  messageSpeed: DEFAULT_MESSAGE_SPEED,
  showHomies: true,
  recentMessages: true,
  bots: true,
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
  overlayBorderOpacity: 0,
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
  animate: { query: "a", kind: "bool", aliases: ["animate"] },
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
  overlayBorderOpacity: {
    query: "bgb",
    kind: "int",
    aliases: ["overlay_border_opacity"],
  },
};

function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return null;
}

function parseIntSafe(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
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

  cfg.messageSpeed = clampMessageSpeed(cfg.messageSpeed);
  cfg.fontWeight = normalizeFontWeight(cfg.fontWeight);
  cfg.nickFontWeight = normalizeFontWeight(cfg.nickFontWeight);

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
