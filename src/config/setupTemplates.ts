import { DEFAULT_CHAT_CONFIG } from "./chatUrlParams";
import { DEFAULT_EVENT_COLORS } from "./eventColors";
import type { SetupImportPatch } from "./setupImport";

const STORAGE_KEY = "chatyx.setup.templates.v1";
const STORAGE_VERSION = 1;

type VisualSettingKey =
  | "animation"
  | "emoteScale"
  | "font"
  | "fontCustom"
  | "fontWeight"
  | "gifScale"
  | "highlightTwitchEvents"
  | "lineHeight"
  | "linkColor"
  | "linkMode"
  | "nickFontWeight"
  | "overlayBackgroundColor"
  | "overlayBackgroundOpacity"
  | "overlayBackgroundRadius"
  | "overlayBorderWidth"
  | "overlayBorderColor"
  | "overlayPadding"
  | "platformMarker"
  | "shadow"
  | "showChannelPointRewards"
  | "showGifs"
  | "showGigantifiedEmotes"
  | "showHighlightedMessages"
  | "showPredictions"
  | "size"
  | "smallCaps"
  | "stroke"
  | "eventColorDefault"
  | "eventColorFirst"
  | "eventColorHighlight"
  | "eventColorReward"
  | "eventColorSubscription"
  | "eventColorRaid"
  | "eventColorStreak"
  | "eventColorPowerUp"
  | "eventColorAnnPrimary"
  | "eventColorAnnPurple"
  | "eventColorAnnBlue"
  | "eventColorAnnGreen"
  | "eventColorAnnOrange"
  | "eventColorOpacity"
  | "twitchEventBold"
  | "twitchEventItalic"
  | "usersColor";

export type VisualSetupPatch = Pick<SetupImportPatch, VisualSettingKey>;

export type TemplateSource = "manual" | "chatyx" | "chatis" | "cyan" | "davii";

export type UserSetupTemplate = {
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly source: TemplateSource;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly settings: VisualSetupPatch;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type BuiltInSetupTemplate = {
  readonly id: "standard" | "atom";
  readonly settings: VisualSetupPatch;
};

export const BUILT_IN_SETUP_TEMPLATES: readonly BuiltInSetupTemplate[] = [
  {
    id: "standard",
    settings: {
      animation: DEFAULT_CHAT_CONFIG.animation,
      emoteScale: DEFAULT_CHAT_CONFIG.emoteScale,
      font: DEFAULT_CHAT_CONFIG.font,
      fontCustom: DEFAULT_CHAT_CONFIG.fontCustom,
      fontWeight: DEFAULT_CHAT_CONFIG.fontWeight,
      gifScale: DEFAULT_CHAT_CONFIG.gifScale,
      highlightTwitchEvents: DEFAULT_CHAT_CONFIG.highlightTwitchEvents,
      lineHeight: DEFAULT_CHAT_CONFIG.lineHeight,
      linkColor: DEFAULT_CHAT_CONFIG.linkColor,
      linkMode: DEFAULT_CHAT_CONFIG.linkMode,
      nickFontWeight: DEFAULT_CHAT_CONFIG.nickFontWeight,
      overlayBackgroundColor: DEFAULT_CHAT_CONFIG.overlayBackgroundColor,
      overlayBackgroundOpacity: DEFAULT_CHAT_CONFIG.overlayBackgroundOpacity,
      overlayBackgroundRadius: DEFAULT_CHAT_CONFIG.overlayBackgroundRadius,
      overlayBorderWidth: DEFAULT_CHAT_CONFIG.overlayBorderWidth,
      overlayBorderColor: DEFAULT_CHAT_CONFIG.overlayBorderColor,
      overlayPadding: DEFAULT_CHAT_CONFIG.overlayPadding,
      platformMarker: DEFAULT_CHAT_CONFIG.platformMarker,
      shadow: DEFAULT_CHAT_CONFIG.shadow,
      showChannelPointRewards: DEFAULT_CHAT_CONFIG.showChannelPointRewards,
      showGifs: DEFAULT_CHAT_CONFIG.showGifs,
      showGigantifiedEmotes: DEFAULT_CHAT_CONFIG.showGigantifiedEmotes,
      showHighlightedMessages: DEFAULT_CHAT_CONFIG.showHighlightedMessages,
      showPredictions: DEFAULT_CHAT_CONFIG.showPredictions,
      size: DEFAULT_CHAT_CONFIG.size,
      smallCaps: DEFAULT_CHAT_CONFIG.smallCaps,
      stroke: DEFAULT_CHAT_CONFIG.stroke,
      ...DEFAULT_EVENT_COLORS,
      eventColorOpacity: DEFAULT_CHAT_CONFIG.eventColorOpacity,
      twitchEventBold: DEFAULT_CHAT_CONFIG.twitchEventBold,
      twitchEventItalic: DEFAULT_CHAT_CONFIG.twitchEventItalic,
      usersColor: DEFAULT_CHAT_CONFIG.usersColor,
    },
  },
  {
    id: "atom",
    settings: {
      animation: "fade",
      emoteScale: 1,
      font: 13,
      fontCustom: "",
      fontWeight: 600,
      gifScale: 1,
      highlightTwitchEvents: false,
      lineHeight: 100,
      linkColor: "#BD1313",
      linkMode: "highlight",
      nickFontWeight: 600,
      overlayBackgroundColor: "#000000",
      overlayBackgroundOpacity: 0,
      overlayBackgroundRadius: 20,
      overlayBorderWidth: 0,
      overlayBorderColor: "#ffffff",
      overlayPadding: 10,
      platformMarker: "stripe",
      shadow: false,
      showChannelPointRewards: false,
      showGifs: false,
      showGigantifiedEmotes: true,
      showHighlightedMessages: false,
      showPredictions: false,
      size: 1,
      smallCaps: true,
      stroke: false,
      ...DEFAULT_EVENT_COLORS,
      eventColorOpacity: 0,
      twitchEventBold: false,
      twitchEventItalic: false,
      usersColor: "#BD1313",
    },
  },
];

function hasStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

function getStorage(): StorageLike | null {
  if (!hasStorage()) return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isTemplateSource(value: unknown): value is TemplateSource {
  return value === "manual" || value === "chatyx" || value === "chatis" || value === "cyan" || value === "davii";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeName(name: string, fallbackName: string, templates: readonly UserSetupTemplate[]): string {
  const baseName = name.trim().slice(0, 48) || fallbackName;
  const existingNames = new Set(templates.map((template) => template.name.toLocaleLowerCase()));
  if (!existingNames.has(baseName.toLocaleLowerCase())) return baseName;

  let index = 2;
  while (existingNames.has(`${baseName} ${index}`.toLocaleLowerCase())) index += 1;
  return `${baseName} ${index}`;
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `template-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function toVisualSetupPatch<T extends Partial<Record<VisualSettingKey, unknown>>>(patch: T): VisualSetupPatch {
  const keys: readonly VisualSettingKey[] = [
    "animation",
    "emoteScale", "font", "fontCustom", "fontWeight", "gifScale", "highlightTwitchEvents", "lineHeight", "linkColor", "linkMode", "nickFontWeight",
    "overlayBackgroundColor", "overlayBackgroundOpacity", "overlayBackgroundRadius", "overlayBorderWidth", "overlayBorderColor",
    "overlayPadding", "platformMarker", "shadow", "showChannelPointRewards", "showGifs", "showGigantifiedEmotes", "showHighlightedMessages", "showPredictions", "size", "smallCaps", "stroke",
    "eventColorDefault", "eventColorFirst", "eventColorHighlight", "eventColorReward", "eventColorSubscription", "eventColorRaid", "eventColorStreak", "eventColorPowerUp", "eventColorAnnPrimary", "eventColorAnnPurple", "eventColorAnnBlue", "eventColorAnnGreen", "eventColorAnnOrange", "eventColorOpacity", "twitchEventBold", "twitchEventItalic", "usersColor",
  ];

  return Object.fromEntries(
    keys.flatMap((key) => patch[key] === undefined ? [] : [[key, patch[key]]]),
  ) as VisualSetupPatch;
}

function isUserTemplate(value: unknown): value is UserSetupTemplate {
  if (!isRecord(value) || value.version !== STORAGE_VERSION || !isRecord(value.settings)) return false;
  return typeof value.id === "string" && typeof value.name === "string" && isTemplateSource(value.source)
    && typeof value.createdAt === "string" && typeof value.updatedAt === "string";
}

export function readUserSetupTemplates(storage = getStorage()): UserSetupTemplate[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.templates)) return [];
    return parsed.templates
      .filter(isUserTemplate)
      .map((template) => ({ ...template, settings: toVisualSetupPatch(template.settings) }))
      .filter((template) => Object.keys(template.settings).length > 0);
  } catch {
    return [];
  }
}

export function writeUserSetupTemplates(templates: readonly UserSetupTemplate[], storage = getStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, templates }));
    return true;
  } catch {
    return false;
  }
}

export function createUserSetupTemplate(
  settings: SetupImportPatch,
  options: { readonly name: string; readonly fallbackName: string; readonly source: TemplateSource },
  templates: readonly UserSetupTemplate[],
): UserSetupTemplate | null {
  const visualSettings = toVisualSetupPatch(settings);
  if (Object.keys(visualSettings).length === 0) return null;

  const now = new Date().toISOString();
  return {
    version: STORAGE_VERSION,
    id: createId(),
    name: normalizeName(options.name, options.fallbackName, templates),
    source: options.source,
    createdAt: now,
    updatedAt: now,
    settings: visualSettings,
  };
}

export function renameUserSetupTemplate(
  id: string,
  name: string,
  templates: readonly UserSetupTemplate[],
): UserSetupTemplate[] {
  const target = templates.find((template) => template.id === id);
  if (!target || !name.trim()) return [...templates];
  const otherTemplates = templates.filter((template) => template.id !== id);
  const nextName = normalizeName(name, target.name, otherTemplates);
  return templates.map((template) => template.id === id
    ? { ...template, name: nextName, updatedAt: new Date().toISOString() }
    : template,
  );
}

export function deleteUserSetupTemplate(id: string, templates: readonly UserSetupTemplate[]): UserSetupTemplate[] {
  return templates.filter((template) => template.id !== id);
}
