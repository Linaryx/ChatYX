import { TWITCH_CONFIG, FALLBACK_APIS, fetchWithFallback } from "~/config/twitch";
import { twitchGqlService, type TwitchGqlBadge } from "~/services/chat/twitchGqlService";
import { log, LOG_CATEGORIES } from "~/utils/logger";

export interface Badge {
  source: string;
  description: string;
  url: string;
  color?: string;
}

export interface UserBadges {
  [username: string]: Badge[];
}

export interface BadgeData {
  badges: { [key: string]: string };
  userBadges: UserBadges;
  ffzUserBadges: UserBadges;
  ffzBadgesById: Map<number, Badge>;
  ffzRoomUserBadges: { [badgeId: string]: string[] } | null;
  ffzapBadges: any[];
  bttvBadges: any[];
  chatterinoBadges: any[];
  homiesBadges: {
    1: any[];
    2: any[];
    3: any[];
  };
  chatisBadges: {
    urlPrefix: string;
    modBadge: Map<string, string>;
    userBadges: Map<string, Map<string, string>>;
  };
  seventvBadges: { [id: string]: any };
}

export type ThirdPartyBadgeIndex = {
  byUserId: Map<string, Badge[]>;
  byUsername: Map<string, Badge[]>;
};

const THIRD_PARTY_BADGE_ORDER: Record<string, number> = {
  ffzap: 0,
  bttv: 1,
  chatterino: 2,
  homies: 3,
};

function addIndexedBadge(
  index: Map<string, Badge[]>,
  key: string,
  badge: Badge,
) {
  if (!key || !badge.url) return;

  const badges = index.get(key) ?? [];
  if (
    !badges.some(
      (entry) => entry.source === badge.source && entry.url === badge.url,
    )
  ) {
    badges.push(badge);
    index.set(key, badges);
  }
}

export function buildThirdPartyBadgeIndex(
  data: Pick<
    BadgeData,
    "ffzapBadges" | "bttvBadges" | "chatterinoBadges" | "homiesBadges"
  >,
): ThirdPartyBadgeIndex {
  const index: ThirdPartyBadgeIndex = {
    byUserId: new Map(),
    byUsername: new Map(),
  };

  if (Array.isArray(data.ffzapBadges)) {
    for (const user of data.ffzapBadges) {
      const userId = String(user?.id ?? "");
      if (!userId) continue;

      let color = "#755000";
      if (Number(user.tier) === 2) {
        color = user.badge_color || "#755000";
      } else if (Number(user.tier) === 3) {
        color = Number(user.badge_is_colored) === 0
          ? user.badge_color || "#755000"
          : "";
      }

      addIndexedBadge(index.byUserId, userId, {
        source: "ffzap",
        description: "FFZ:AP Badge",
        url: `https://api.ffzap.com/v1/user/badge/${userId}/3`,
        color,
      });
    }
  }

  if (Array.isArray(data.bttvBadges)) {
    for (const user of data.bttvBadges) {
      const username = String(user?.name ?? "").toLowerCase();
      addIndexedBadge(index.byUsername, username, {
        source: "bttv",
        description: String(user?.badge?.description ?? "BTTV Badge"),
        url: String(user?.badge?.svg ?? ""),
      });
    }
  }

  if (Array.isArray(data.chatterinoBadges)) {
    for (const badge of data.chatterinoBadges) {
      if (!Array.isArray(badge?.users)) continue;

      const indexedBadge: Badge = {
        source: "chatterino",
        description: String(badge.tooltip ?? "Chatterino Badge"),
        url: String(badge.image3 || badge.image2 || badge.image1 || ""),
      };
      for (const userId of badge.users) {
        addIndexedBadge(index.byUserId, String(userId), indexedBadge);
      }
    }
  }

  for (const tier of [1, 2] as const) {
    const badges = data.homiesBadges[tier];
    if (!Array.isArray(badges)) continue;

    for (const badge of badges) {
      if (!Array.isArray(badge?.users)) continue;

      const indexedBadge: Badge = {
        source: "homies",
        description: String(badge.tooltip || "Homies Badge"),
        url: String(badge.image3 || ""),
      };
      for (const userId of badge.users) {
        addIndexedBadge(index.byUserId, String(userId), indexedBadge);
      }
    }
  }

  if (Array.isArray(data.homiesBadges[3])) {
    for (const badge of data.homiesBadges[3]) {
      addIndexedBadge(index.byUserId, String(badge?.userId ?? ""), {
        source: "homies",
        description: String(badge?.tooltip || "Homies Badge"),
        url: String(badge?.image3 || ""),
      });
    }
  }

  return index;
}

export function getIndexedThirdPartyBadges(
  index: ThirdPartyBadgeIndex,
  userId: string,
  username: string,
): Badge[] {
  return [
    ...(index.byUserId.get(userId) ?? []),
    ...(index.byUsername.get(username.toLowerCase()) ?? []),
  ].sort(
    (left, right) =>
      (THIRD_PARTY_BADGE_ORDER[left.source] ?? Number.MAX_SAFE_INTEGER) -
      (THIRD_PARTY_BADGE_ORDER[right.source] ?? Number.MAX_SAFE_INTEGER),
  );
}

class BadgeService {
  private currentChannelId = "";
  private thirdPartyBadgesReady: Promise<void> | null = null;
  private thirdPartyBadgeIndex: ThirdPartyBadgeIndex = {
    byUserId: new Map(),
    byUsername: new Map(),
  };
  private badgeData: BadgeData = {
    badges: {
      // Локальные fallback баджи с Twitch CDN (работают всегда)
      "broadcaster:1":
        "https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3",
      "moderator:1":
        "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3",
      "vip:1":
        "https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/3",
      "founder:0":
        "https://static-cdn.jtvnw.net/badges/v1/511b78a9-ab37-472f-9569-457753bbe7d3/3",
    },
    userBadges: {},
    ffzUserBadges: {},
    ffzBadgesById: new Map(),
    ffzRoomUserBadges: null,
    ffzapBadges: [],
    bttvBadges: [],
    chatterinoBadges: [],
    homiesBadges: {
      1: [],
      2: [],
      3: [],
    },
    chatisBadges: {
      urlPrefix: "https://chatis.is2511.com/v2/badges",
      modBadge: new Map(
        [3, 2, 1].map((size) => {
          return [
            `${size}`,
            `https://chatis.is2511.com/v2/badges/chatis-mod/${size}x.png`,
          ];
        }),
      ),
      userBadges: new Map<string, Map<string, string>>([
        [
          "is2511",
          new Map([
            ["3", "https://chatis.is2511.com/v2/badges/users/is2511/3x.webp"],
            ["2", "https://chatis.is2511.com/v2/badges/users/is2511/2x.webp"],
            ["1", "https://chatis.is2511.com/v2/badges/users/is2511/1x.webp"],
          ]),
        ],
        [
          "arturthefoe",
          new Map([
            [
              "3",
              "https://chatis.is2511.com/v2/badges/users/arturthefoe/3x.png",
            ],
            [
              "2",
              "https://chatis.is2511.com/v2/badges/users/arturthefoe/2x.png",
            ],
            [
              "1",
              "https://chatis.is2511.com/v2/badges/users/arturthefoe/1x.png",
            ],
          ]),
        ],
        [
          "shooksby",
          new Map([
            ["3", "https://chatis.is2511.com/v2/badges/users/shooksby/3x.png"],
            ["2", "https://chatis.is2511.com/v2/badges/users/shooksby/2x.png"],
            ["1", "https://chatis.is2511.com/v2/badges/users/shooksby/1x.png"],
          ]),
        ],
        [
          "dj_ziggy",
          new Map([
            ["3", "https://chatis.is2511.com/v2/badges/users/dj_ziggy/3x.png"],
          ]),
        ],
        [
          "liptongod",
          new Map([
            [
              "3",
              "https://chatis.is2511.com/v2/badges/users/liptongod/3x.webp",
            ],
            [
              "2",
              "https://chatis.is2511.com/v2/badges/users/liptongod/2x.webp",
            ],
            [
              "1",
              "https://chatis.is2511.com/v2/badges/users/liptongod/1x.webp",
            ],
          ]),
        ],
        [
          "itsbandorax",
          new Map([
            [
              "3",
              "https://chatis.is2511.com/v2/badges/users/itsbandorax/3x.webp",
            ],
            [
              "2",
              "https://chatis.is2511.com/v2/badges/users/itsbandorax/2x.webp",
            ],
            [
              "1",
              "https://chatis.is2511.com/v2/badges/users/itsbandorax/1x.webp",
            ],
          ]),
        ],
        [
          "styles",
          new Map([
            ["3", "https://chatis.is2511.com/v2/badges/users/styles/3x.webp"],
            ["2", "https://chatis.is2511.com/v2/badges/users/styles/2x.webp"],
            ["1", "https://chatis.is2511.com/v2/badges/users/styles/1x.webp"],
          ]),
        ],
        [
          "truer",
          new Map([
            ["3", "https://chatis.is2511.com/v2/badges/users/truer/3x.png"],
            ["2", "https://chatis.is2511.com/v2/badges/users/truer/2x.png"],
            ["1", "https://chatis.is2511.com/v2/badges/users/truer/1x.png"],
          ]),
        ],
        [
          "platonicthough",
          new Map([
            [
              "3",
              "https://chatis.is2511.com/v2/badges/users/platonicthough/3x.png",
            ],
          ]),
        ],
      ]),
    },
    seventvBadges: {},
  };

  async loadBadges(channel: string, channelId: string): Promise<void> {
    this.currentChannelId = channelId;

    try {
      // Загружаем все баджи параллельно для оптимизации
      // 7TV баджи грузятся через WebSocket EventAPI (как в v2)
      // Third-party баджи грузим в фоне (не блокируем инициализацию IRC)
      await this.loadTwitchBadges(channelId, channel);
      void this.loadTwitchGqlBadgeSets(channelId);
      // Third-party badges stay background-loaded, but user badge resolution
      // waits for this promise to avoid caching empty recent-message badges.
      void this.ensureThirdPartyBadgesReady();
    } catch (error) {
      log.error(LOG_CATEGORIES.BADGE, " Failed to load badges:", error);
    }
  }

  private async loadTwitchBadges(
    channelId: string,
    channelName: string,
  ): Promise<void> {
    try {
      // Глобальные баджи с автоматическим fallback
      const globalResponse = await fetchWithFallback(
        `${TWITCH_CONFIG.API_BASE_URL}/badges/global`,
        FALLBACK_APIS.badges_global,
      );

      if (globalResponse.ok) {
        const globalData = await globalResponse.json();
        const badges = Array.isArray(globalData) ? globalData : globalData.data;

        if (Array.isArray(badges)) {
          for (const badgeSet of badges) {
            const badgeName = badgeSet.set_id;
            if (Array.isArray(badgeSet.versions)) {
              for (const badgeVersion of badgeSet.versions) {
                // Перезаписываем локальные fallback баджи реальными из API
                this.badgeData.badges[`${badgeName}:${badgeVersion.id}`] =
                  badgeVersion.image_url_4x;
              }
            }
          }
        }
      } else {
        log.warn(LOG_CATEGORIES.BADGE, " Failed to load global badges, using local fallbacks",
        );
      }

      // Канальные баджи с автоматическим fallback
      const channelResponse = await fetchWithFallback(
        `${TWITCH_CONFIG.API_BASE_URL}/badges/channel?broadcaster_id=${encodeURIComponent(channelId)}`,
        FALLBACK_APIS.badges_channel(channelName),
      );

      if (channelResponse.ok) {
        const channelData = await channelResponse.json();
        const badges = Array.isArray(channelData)
          ? channelData
          : channelData.data;

        if (Array.isArray(badges)) {
          for (const badgeSet of badges) {
            const badgeName = badgeSet.set_id;
            if (Array.isArray(badgeSet.versions)) {
              for (const badgeVersion of badgeSet.versions) {
                // Перезаписываем локальные fallback баджи реальными из API
                this.badgeData.badges[`${badgeName}:${badgeVersion.id}`] =
                  badgeVersion.image_url_4x;
              }
            }
          }
        }
      } else {
        log.warn(LOG_CATEGORIES.BADGE, "Failed to load channel badges, using local fallbacks");
      }

      // FFZ комнатные баджи
      try {
        const ffzRoomResponse = await fetch(
          `https://api.frankerfacez.com/v1/_room/id/${encodeURIComponent(channelId)}`,
        );
        if (ffzRoomResponse.ok) {
          const ffzRoomData = await ffzRoomResponse.json();

          if (ffzRoomData.room?.moderator_badge) {
            this.badgeData.badges["moderator:1"] =
              `https://cdn.frankerfacez.com/room-badge/mod/${channelName}/4/rounded`;
          }
          if (ffzRoomData.room?.vip_badge) {
            this.badgeData.badges["vip:1"] =
              `https://cdn.frankerfacez.com/room-badge/vip/${channelName}/4`;
          }

          if (ffzRoomData.room?.user_badges) {
            this.badgeData.ffzRoomUserBadges = ffzRoomData.room.user_badges;
            this.applyFfzRoomBadges();
          }
        }
      } catch (error) {
        log.error(LOG_CATEGORIES.BADGE, " Failed to load FFZ room badges:", error);
      }
    } catch (error) {
      log.error(LOG_CATEGORIES.BADGE, " Failed to load Twitch badges:", error);
    }
  }

  private async loadThirdPartyBadges(): Promise<void> {
    // Загружаем все баджи параллельно для оптимизации
    const results = await Promise.allSettled([
      // FFZ badges (for bot/other global user badges)
      fetch("https://api.frankerfacez.com/v1/badges/ids").then((r) =>
        r.ok ? r.json() : null,
      ),
      // FFZ:AP баджи (fallback на corsproxy.io при CORS блокировке)
      fetch("https://api.ffzap.com/v1/supporters")
        .then((r) => (r.ok ? r.json() : []))
        .catch(() =>
          fetch(
            "https://corsproxy.io/?url=https://api.ffzap.com/v1/supporters",
          ).then((r) => (r.ok ? r.json() : [])),
        )
        .catch(() => []),
      // BTTV баджи
      fetch("https://api.betterttv.net/3/cached/badges").then((r) =>
        r.ok ? r.json() : [],
      ),
      // Chatterino баджи
      fetch("https://api.chatterino.com/badges").then((r) =>
        r.ok ? r.json().then((d) => d.badges) : [],
      ),
      // Homies баджи 1
      fetch("https://itzalex.github.io/badges").then((r) =>
        r.ok ? r.json().then((d) => d.badges) : [],
      ),
      // Homies баджи 2
      fetch("https://itzalex.github.io/badges2").then((r) =>
        r.ok ? r.json().then((d) => d.badges) : [],
      ),
      // Homies баджи 3
      fetch("https://chatterinohomies.com/api/badges/list").then((r) =>
        r.ok ? r.json().then((d) => d.badges || []) : [],
      ),
    ]);

    const ffzBadgeData =
      results[0].status === "fulfilled" ? results[0].value : null;
    if (ffzBadgeData?.badges) {
      const ffzBadges = Array.isArray(ffzBadgeData.badges)
        ? ffzBadgeData.badges
        : Object.values(ffzBadgeData.badges);

      ffzBadges.forEach((badge: any) => {
        const badgeUrl =
          badge?.urls?.["4"] || badge?.urls?.["2"] || badge?.urls?.["1"];
        if (!badgeUrl) return;

        const userBadge: Badge = {
          source: "ffz",
          description: badge.title || badge.name || "FFZ Badge",
          url: badgeUrl,
          color: badge.color,
        };

        const badgeId =
          typeof badge.id === "number" ? badge.id : Number(badge.id);
        if (!Number.isNaN(badgeId)) {
          this.badgeData.ffzBadgesById.set(badgeId, userBadge);
        }
      });
    }

    if (ffzBadgeData?.users) {
      Object.entries(ffzBadgeData.users).forEach(
        ([badgeId, users]: [string, any]) => {
          const badge = this.badgeData.ffzBadgesById.get(Number(badgeId));
          if (!badge || !Array.isArray(users)) return;

          users.forEach((userId: number | string) => {
            const userKey = String(userId);
            if (!this.badgeData.ffzUserBadges[userKey]) {
              this.badgeData.ffzUserBadges[userKey] = [];
            }
            if (
              !this.badgeData.ffzUserBadges[userKey].some(
                (b) => b.url === badge.url,
              )
            ) {
              this.badgeData.ffzUserBadges[userKey].push(badge);
            }
          });
        },
      );
    }
    this.applyFfzRoomBadges();

    this.badgeData.ffzapBadges =
      results[1].status === "fulfilled" ? results[1].value : [];
    this.badgeData.bttvBadges =
      results[2].status === "fulfilled" ? results[2].value : [];
    this.badgeData.chatterinoBadges =
      results[3].status === "fulfilled" ? results[3].value : [];
    this.badgeData.homiesBadges[1] =
      results[4].status === "fulfilled" ? results[4].value : [];
    this.badgeData.homiesBadges[2] =
      results[5].status === "fulfilled" ? results[5].value : [];
    this.badgeData.homiesBadges[3] =
      results[6].status === "fulfilled" ? results[6].value : [];
    this.thirdPartyBadgeIndex = buildThirdPartyBadgeIndex(this.badgeData);
  }

  async loadUserBadges(
    username: string,
    userId: string,
    includeTwitchSender = false,
  ): Promise<Badge[]> {
    // Проверяем кэш
    if (this.badgeData.userBadges[username]) {
      return this.badgeData.userBadges[username];
    }

    const userBadges: Badge[] = [];

    try {
      await this.ensureThirdPartyBadgesReady();

      const normalizedUsername = username.toLowerCase();

      if (includeTwitchSender) {
        const gqlSender = await twitchGqlService.loadSender(
          this.currentChannelId,
          userId,
        );
        if (gqlSender) {
          this.applyGqlBadgesToCache(gqlSender.displayBadges);
        }
      }

      // FFZ badges from global list (e.g., bot badge)
      const ffzGlobalBadgesById = this.badgeData.ffzUserBadges[userId] || [];
      const ffzGlobalBadgesByName =
        this.badgeData.ffzUserBadges[normalizedUsername] || [];
      const ffzGlobalBadges = [
        ...ffzGlobalBadgesById,
        ...ffzGlobalBadgesByName,
      ];
      if (ffzGlobalBadges.length) {
        ffzGlobalBadges.forEach((badge) => {
          if (
            !userBadges.some(
              (b) => b.url === badge.url && b.source === badge.source,
            )
          ) {
            userBadges.push(badge);
          }
        });
      }

      for (const badge of getIndexedThirdPartyBadges(
        this.thirdPartyBadgeIndex,
        userId,
        normalizedUsername,
      )) {
        if (
          !userBadges.some(
            (entry) =>
              entry.source === badge.source && entry.url === badge.url,
          )
        ) {
          userBadges.push(badge);
        }
      }

      // ChatIS баджи
      const chatisUserBadges =
        this.badgeData.chatisBadges.userBadges.get(username);
      if (chatisUserBadges) {
        const userBadge: Badge = {
          source: "chatis",
          description: "ChatIS Badge",
          url:
            chatisUserBadges.get("3") ||
            chatisUserBadges.get("2") ||
            chatisUserBadges.get("1") ||
            "",
        };
        if (
          userBadge.url &&
          !userBadges.some(
            (b) =>
              b.source === userBadge.source &&
              b.description === userBadge.description,
          )
        ) {
          userBadges.push(userBadge);
        }
      }
    } catch (error) {
      log.error(
        LOG_CATEGORIES.BADGE,
        `Failed to load user badges for ${username}`,
        error,
      );
    }

    this.badgeData.userBadges[username] = userBadges;
    return userBadges;
  }

  private ensureThirdPartyBadgesReady(): Promise<void> {
    if (!this.thirdPartyBadgesReady) {
      this.thirdPartyBadgesReady = this.loadThirdPartyBadges().catch((error) => {
        log.error(LOG_CATEGORIES.BADGE, "Failed to load third-party badges", error);
      });
    }

    return this.thirdPartyBadgesReady;
  }

  private async loadTwitchGqlBadgeSets(channelId: string): Promise<void> {
    const badges = await twitchGqlService.loadBadgeSets(channelId);
    this.applyGqlBadgesToCache(badges);
  }

  private applyGqlBadgesToCache(badges: TwitchGqlBadge[]): void {
    for (const badge of badges) {
      const setId = badge.setID || badge.setId || "";
      const version = badge.version || "";
      const url = twitchGqlService.getBadgeUrl(badge);
      if (!setId || !version || !url) continue;

      this.badgeData.badges[`${setId}:${version}`] = url;
    }
  }

  getTwitchBadge(badgeName: string, badgeVersion: string): string | undefined {
    return this.badgeData.badges[`${badgeName}:${badgeVersion}`];
  }

  getUserBadges(username: string): Badge[] {
    return this.badgeData.userBadges[username] || [];
  }

  getBadgeData(): BadgeData {
    return this.badgeData;
  }

  addSevenTVBadge(id: string, data: any): void {
    // Добавляем 7TV badge в структуру данных
    if (data && data.host && data.host.url) {
      const badgeUrl = `https:${data.host.url}/4x.webp`;
      this.badgeData.badges[`7tv:${id}`] = badgeUrl;
      this.badgeData.seventvBadges[id] = data;
    } else {
      log.warn(LOG_CATEGORIES.BADGE, `Invalid 7TV badge data for ${id}`);
      // Попробуем загрузить бадж через API, если данные неполные
      this.loadMissingBadge(id);
    }
  }

  removeSevenTVBadge(id: string): void {
    delete this.badgeData.badges[`7tv:${id}`];
    delete this.badgeData.seventvBadges[id];
  }

  async addUserSevenTVBadge(username: string, badgeId: string): Promise<void> {
    if (!this.badgeData.userBadges[username]) {
      this.badgeData.userBadges[username] = [];
    }

    const badgeUrl = this.badgeData.badges[`7tv:${badgeId}`];

    // Проверяем, есть ли бадж в загруженных
    if (!badgeUrl) {
      log.warn(LOG_CATEGORIES.BADGE, `7TV badge ${badgeId} not found in cache, fetching...`);

      // Попробуем загрузить бадж через API
      await this.loadMissingBadge(badgeId);

      // Проверяем еще раз после загрузки
      const newBadgeUrl = this.badgeData.badges[`7tv:${badgeId}`];

      if (!newBadgeUrl) {
        log.warn(LOG_CATEGORIES.BADGE, `7TV badge ${badgeId} still missing after fetch`);
        return;
      }
    }

    const finalBadgeUrl = this.badgeData.badges[`7tv:${badgeId}`];
    if (finalBadgeUrl) {
      const badge: Badge = {
        source: "7tv",
        description: "7TV Badge",
        url: finalBadgeUrl,
      };

      if (
        !this.badgeData.userBadges[username].some(
          (b) => b.source === badge.source && b.url === badge.url,
        )
      ) {
        this.badgeData.userBadges[username].push(badge);
      }
    } else {
      log.warn(LOG_CATEGORIES.BADGE, `7TV badge ${badgeId} not found in loaded badges`);
    }
  }

  removeUserSevenTVBadge(username: string, badgeId: string): void {
    if (!this.badgeData.userBadges[username]) {
      return;
    }

    const badgeUrl = this.badgeData.badges[`7tv:${badgeId}`];
    if (badgeUrl) {
      this.badgeData.userBadges[username] = this.badgeData.userBadges[
        username
      ].filter((badge) => !(badge.source === "7tv" && badge.url === badgeUrl));
    }
  }

  private async loadMissingBadge(badgeId: string): Promise<void> {
    try {
      const response = await fetch("https://7tv.io/v3/gql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
                        query GetBadge($id: ObjectID!) {
                            badge(id: $id) {
                                id
                                name
                                host {
                                    url
                                }
                            }
                        }
                    `,
          variables: {
            id: badgeId,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.data?.badge) {
          const badge = data.data.badge;
          this.addSevenTVBadge(badge.id, badge);

          // Теперь попробуем снова добавить бадж пользователю
          const badgeUrl = this.badgeData.badges[`7tv:${badgeId}`];
          if (!badgeUrl) {
            log.warn(LOG_CATEGORIES.BADGE, `7TV badge ${badgeId} missing from cache after add`);
          }
        } else {
          log.warn(LOG_CATEGORIES.BADGE, `7TV badge ${badgeId} not found in API`);
        }
      } else {
        log.error(LOG_CATEGORIES.BADGE, `Failed to load 7TV badge ${badgeId}: HTTP ${response.status}`);
      }
    } catch (error) {
      log.error(LOG_CATEGORIES.BADGE, `Error loading 7TV badge ${badgeId}`, error);
    }
  }

  private applyFfzRoomBadges(): void {
    if (!this.badgeData.ffzRoomUserBadges) return;
    if (this.badgeData.ffzBadgesById.size === 0) return;

    Object.entries(this.badgeData.ffzRoomUserBadges).forEach(
      ([badgeId, users]: [string, any]) => {
        const badge = this.badgeData.ffzBadgesById.get(Number(badgeId));
        if (!badge || !Array.isArray(users)) return;

        users.forEach((user: string | number) => {
          const userKey = String(user);
          if (!this.badgeData.ffzUserBadges[userKey]) {
            this.badgeData.ffzUserBadges[userKey] = [];
          }
          if (
            !this.badgeData.ffzUserBadges[userKey].some(
              (b) => b.url === badge.url,
            )
          ) {
            this.badgeData.ffzUserBadges[userKey].push(badge);
          }

          const normalizedUserKey = userKey.toLowerCase();
          if (normalizedUserKey !== userKey) {
            if (!this.badgeData.ffzUserBadges[normalizedUserKey]) {
              this.badgeData.ffzUserBadges[normalizedUserKey] = [];
            }
            if (
              !this.badgeData.ffzUserBadges[normalizedUserKey].some(
                (b) => b.url === badge.url,
              )
            ) {
              this.badgeData.ffzUserBadges[normalizedUserKey].push(badge);
            }
          }
        });
      },
    );
  }
}

export const badgeService = new BadgeService();
