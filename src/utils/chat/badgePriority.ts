export type ThirdPartyBadge = {
  source: string;
  url?: string;
  title?: string;
  description?: string;
  color?: string;
};

export const TWITCH_ROLE_BADGES = new Set([
  "broadcaster",
  "lead_moderator",
  "moderator",
  "vip",
]);
export const TWITCH_SUB_BADGES = new Set(["subscriber", "founder"]);

export const isTwitchRoleBadge = (name: string): boolean =>
  TWITCH_ROLE_BADGES.has(name);

export const isTwitchSubBadge = (name: string): boolean =>
  TWITCH_SUB_BADGES.has(name);

export const isTwitchVanityBadge = (name: string): boolean =>
  !isTwitchRoleBadge(name) && !isTwitchSubBadge(name);

export const THIRD_PARTY_BADGE_ORDER = [
  "homies",
  "vanity",
  "chatterino",
  "ffz_sub",
  "ffz",
  "other",
] as const;

export type ThirdPartyBadgeGroup = (typeof THIRD_PARTY_BADGE_ORDER)[number];

export const ROLE_BADGE_ORDER = [
  "broadcaster",
  "lead_moderator",
  "moderator",
  "vip",
] as const;

export const SUB_BADGE_ORDER = ["subscriber", "founder"] as const;

export const BADGE_RENDER_ORDER = [
  "role",
  "homies",
  "sub",
  "vanity",
  "chatterino",
  "ffz_sub",
  "ffz",
  "other",
] as const;

export type BadgeRenderGroup = (typeof BADGE_RENDER_ORDER)[number];

export type BadgeRenderBuckets<T> = Record<BadgeRenderGroup, T[]>;

export const flattenBadgeRenderOrder = <T>(
  buckets: BadgeRenderBuckets<T>,
  order: readonly BadgeRenderGroup[] = BADGE_RENDER_ORDER,
): T[] => order.flatMap((group) => buckets[group]);

const thirdPartyGroupForSource = (source: string): ThirdPartyBadgeGroup => {
  switch (source) {
    case "homies":
      return "homies";
    case "7tv":
    case "chatis":
      return "vanity";
    case "chatterino":
      return "chatterino";
    case "ffz":
      return "ffz";
    default:
      return "other";
  }
};

const isFfzSubscriberBadge = (badge: ThirdPartyBadge): boolean => {
  if (badge.source !== "ffz") return false;
  const label = String(badge.title || badge.description || "").toLowerCase();
  return label.includes("subwoofer") || label.includes("subscriber");
};

export const orderThirdPartyBadges = (badges: ThirdPartyBadge[]) => {
  const grouped: Record<ThirdPartyBadgeGroup, ThirdPartyBadge[]> = {
    homies: [],
    vanity: [],
    chatterino: [],
    ffz_sub: [],
    ffz: [],
    other: [],
  };

  badges.forEach((badge) => {
    if (isFfzSubscriberBadge(badge)) {
      grouped.ffz_sub.push(badge);
      return;
    }
    grouped[thirdPartyGroupForSource(badge.source)].push(badge);
  });

  return grouped;
};

export const flattenThirdPartyBadges = (
  grouped: Record<ThirdPartyBadgeGroup, ThirdPartyBadge[]>,
): ThirdPartyBadge[] =>
  THIRD_PARTY_BADGE_ORDER.flatMap((group) => grouped[group]);
