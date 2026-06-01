import { log, LOG_CATEGORIES } from "~/utils/logger";

const GQL_ENDPOINT = "https://gql.twitch.tv/gql";
const TWITCH_WEB_CLIENT_ID =
  import.meta.env.VITE_TWITCH_GQL_CLIENT_ID || "kimne78kx3ncx6brgo4mv6wki5h1ko";

const PERSISTED_QUERIES = {
  BadgeSetsByChannel:
    "e36a0d9f21ec04006dbda91e933c1071d45ecd96b477bfcaa2c3e7b61f83c296",
  AutoModSender:
    "87b94ec5116e7d29af7531eccb5c058ed3ae6cc893eda79c1168dd3db7606461",
  ChannelPointsContext:
    "7fe050e3761eb2cf258d70ee1a21cbd76fa8cf3d7e7b12fc437e7029d446b5e3",
} as const;

export type TwitchGqlBadge = {
  setID?: string;
  setId?: string;
  version?: string;
  title?: string;
  image1x?: string;
  image2x?: string;
  image4x?: string;
};

export type TwitchGqlSender = {
  id: string;
  login: string;
  displayName: string;
  chatColor: string;
  displayBadges: TwitchGqlBadge[];
};

export type TwitchGqlCustomReward = {
  id: string;
  title: string;
  prompt: string;
  cost: number;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Twitch GQL request timed out"));
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

function normalizeBadgeUrl(badge: TwitchGqlBadge): string {
  return badge.image4x || badge.image2x || badge.image1x || "";
}

function isTwitchUserId(value: string): boolean {
  return /^\d+$/.test(value) && value !== "0";
}

class TwitchGqlService {
  private senderCache = new Map<string, Promise<TwitchGqlSender | null>>();
  private badgeSetCache = new Map<string, Promise<TwitchGqlBadge[]>>();
  private channelPointRewardsCache = new Map<
    string,
    Promise<Map<string, TwitchGqlCustomReward>>
  >();

  async loadBadgeSets(channelId: string): Promise<TwitchGqlBadge[]> {
    if (!isTwitchUserId(channelId)) return [];

    const cached = this.badgeSetCache.get(channelId);
    if (cached) return cached;

    const promise = this.request("BadgeSetsByChannel", { channelID: channelId })
      .then((data) => {
        const badges = Array.isArray(data?.badges) ? data.badges : [];
        const broadcastBadges = Array.isArray(data?.channel?.broadcastBadges)
          ? data.channel.broadcastBadges
          : [];
        return [...badges, ...broadcastBadges];
      })
      .catch((error) => {
        log.warn(LOG_CATEGORIES.BADGE, "Twitch GQL badge sets unavailable", error);
        this.badgeSetCache.delete(channelId);
        return [];
      });

    this.badgeSetCache.set(channelId, promise);
    return promise;
  }

  async loadSender(
    channelId: string,
    senderId: string,
  ): Promise<TwitchGqlSender | null> {
    if (!isTwitchUserId(channelId) || !isTwitchUserId(senderId)) return null;

    const cacheKey = `${channelId}:${senderId}`;
    const cached = this.senderCache.get(cacheKey);
    if (cached) return cached;

    const promise = this.request("AutoModSender", {
      channelID: channelId,
      senderID: senderId,
    })
      .then((data) => {
        const user = data?.user;
        if (!user?.id || !user?.login) return null;
        return {
          id: String(user.id),
          login: String(user.login),
          displayName: String(user.displayName || user.login),
          chatColor: String(user.chatColor || ""),
          displayBadges: Array.isArray(user.displayBadges)
            ? user.displayBadges
            : [],
        };
      })
      .catch((error) => {
        log.warn(LOG_CATEGORIES.BADGE, "Twitch GQL sender unavailable", error);
        this.senderCache.delete(cacheKey);
        return null;
      });

    this.senderCache.set(cacheKey, promise);
    return promise;
  }

  async loadChannelPointRewards(
    channelLogin: string,
  ): Promise<Map<string, TwitchGqlCustomReward>> {
    const normalizedLogin = channelLogin.trim().toLowerCase();
    if (!normalizedLogin) return new Map();

    const cached = this.channelPointRewardsCache.get(normalizedLogin);
    if (cached) return cached;

    const promise = this.request("ChannelPointsContext", {
      channelLogin: normalizedLogin,
      includeGoalTypes: ["CREATOR", "BOOST"],
    })
      .then((data) => {
        const rawRewards =
          data?.community?.channel?.communityPointsSettings?.customRewards;
        const rewards = new Map<string, TwitchGqlCustomReward>();

        if (!Array.isArray(rawRewards)) return rewards;

        for (const reward of rawRewards) {
          if (!reward?.id) continue;
          rewards.set(String(reward.id), {
            id: String(reward.id),
            title: String(reward.title || ""),
            prompt: String(reward.prompt || ""),
            cost: Number.isFinite(Number(reward.cost))
              ? Number(reward.cost)
              : 0,
          });
        }

        return rewards;
      })
      .catch((error) => {
        log.warn(
          LOG_CATEGORIES.CHAT,
          "Twitch GQL channel point rewards unavailable",
          error,
        );
        this.channelPointRewardsCache.delete(normalizedLogin);
        return new Map<string, TwitchGqlCustomReward>();
      });

    this.channelPointRewardsCache.set(normalizedLogin, promise);
    return promise;
  }

  getBadgeUrl(badge: TwitchGqlBadge): string {
    return normalizeBadgeUrl(badge);
  }

  private async request(
    operationName: keyof typeof PERSISTED_QUERIES,
    variables: Record<string, unknown>,
  ): Promise<any> {
    const response = await withTimeout(
      fetch(GQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Client-ID": TWITCH_WEB_CLIENT_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operationName,
          variables,
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: PERSISTED_QUERIES[operationName],
            },
          },
        }),
      }),
      3000,
    );

    if (!response.ok) {
      throw new Error(`Twitch GQL HTTP ${response.status}`);
    }

    const payload = await response.json();
    return payload?.data ?? null;
  }
}

export const twitchGqlService = new TwitchGqlService();
