export const EVENT_COLOR_FIELDS = [
  "eventColorDefault",
  "eventColorFirst",
  "eventColorHighlight",
  "eventColorReward",
  "eventColorSubscription",
  "eventColorRaid",
  "eventColorStreak",
  "eventColorPowerUp",
  "eventColorAnnPrimary",
  "eventColorAnnPurple",
  "eventColorAnnBlue",
  "eventColorAnnGreen",
  "eventColorAnnOrange",
] as const;

export type EventColorField = (typeof EVENT_COLOR_FIELDS)[number];
export type EventColorConfig = Record<EventColorField, string>;

export const EVENT_COLOR_TOKENS: Readonly<Record<EventColorField, string>> = {
  eventColorDefault: "d",
  eventColorFirst: "f",
  eventColorHighlight: "h",
  eventColorReward: "r",
  eventColorSubscription: "s",
  eventColorRaid: "ra",
  eventColorStreak: "st",
  eventColorPowerUp: "p",
  eventColorAnnPrimary: "ap",
  eventColorAnnPurple: "au",
  eventColorAnnBlue: "ab",
  eventColorAnnGreen: "ag",
  eventColorAnnOrange: "ao",
};

export const DEFAULT_EVENT_COLORS: EventColorConfig = Object.freeze({
  eventColorDefault: "#9146ff",
  eventColorFirst: "#34d399",
  eventColorHighlight: "#fbbf24",
  eventColorReward: "#f59e0b",
  eventColorSubscription: "#c084fc",
  eventColorRaid: "#60a5fa",
  eventColorStreak: "#2dd4bf",
  eventColorPowerUp: "#f472b6",
  eventColorAnnPrimary: "#9147ff",
  eventColorAnnPurple: "#9900fe",
  eventColorAnnBlue: "#1f69ff",
  eventColorAnnGreen: "#00c800",
  eventColorAnnOrange: "#ff7621",
});

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{6})$/i;

export function normalizeEventColor(value: string, fallback: string): string {
  const match = value.trim().match(HEX_COLOR_PATTERN);
  if (!match) return fallback;
  return `#${match[1].toLowerCase()}`;
}

export function getEventColorField(
  event: { readonly type: string; readonly level?: string } | undefined,
): EventColorField {
  if (!event) return "eventColorDefault";
  switch (event.type) {
    case "first-message": return "eventColorFirst";
    case "highlighted-message": return "eventColorHighlight";
    case "reward": return "eventColorReward";
    case "subscription": return "eventColorSubscription";
    case "raid": return "eventColorRaid";
    case "watch-streak": return "eventColorStreak";
    case "power-up": return "eventColorPowerUp";
    case "announcement":
      switch (event.level?.toUpperCase()) {
        case "PURPLE": return "eventColorAnnPurple";
        case "BLUE": return "eventColorAnnBlue";
        case "GREEN": return "eventColorAnnGreen";
        case "ORANGE": return "eventColorAnnOrange";
        default: return "eventColorAnnPrimary";
      }
    default: return "eventColorDefault";
  }
}

export function eventColorsMatchDefaults(colors: EventColorConfig): boolean {
  return EVENT_COLOR_FIELDS.every(
    (field) => normalizeEventColor(colors[field], DEFAULT_EVENT_COLORS[field]) === DEFAULT_EVENT_COLORS[field],
  );
}
