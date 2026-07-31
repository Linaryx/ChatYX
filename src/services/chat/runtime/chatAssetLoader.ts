import { badgeService } from "~/services/badges";
import { LOG_CATEGORIES, log } from "~/utils/logger";
import { channelRolesService } from "../channelRolesService";
import { emoteService } from "../emoteService";
import {
  sevenTVCosmeticsService,
  type CosmeticRefreshUser,
} from "../sevenTVCosmeticsService";
import { sevenTVEventApi } from "../sevenTVEventApi";
import {
  twitchGqlService,
  type TwitchGqlCustomReward,
} from "../twitchGqlService";

const REWARD_RESOLUTION_TIMEOUT_MS = 350;

type ChatAssetOptions = {
  channelId: string;
  show7tvUnlisted: boolean;
};

export class ChatAssetLoader {
  constructor(private readonly channel: string) {}

  preloadChannelRewards() {
    if (!this.channel.trim()) return;
    void twitchGqlService.loadChannelPointRewards(this.channel).catch(() => {});
  }

  async loadEmotes(options: ChatAssetOptions) {
    await emoteService
      .loadEmotes(options.channelId, this.channel, {
        show7tvUnlisted: options.show7tvUnlisted,
      })
      .catch((error) =>
        log.error(LOG_CATEGORIES.EMOTES, "Failed to load emotes", error),
      );
  }

  loadDeferredAssets(channelId: string, includeChannelRoles: boolean) {
    return Promise.all([
      channelId
        ? badgeService
            .loadBadges(this.channel, channelId)
            .catch((error) =>
              log.error(LOG_CATEGORIES.BADGE, "Failed to load badges", error),
            )
        : undefined,
      channelId
        ? sevenTVCosmeticsService.loadCosmetics(channelId).catch((error) =>
            log.error(LOG_CATEGORIES.PAINTS, "Failed to load cosmetics", error),
          )
        : undefined,
      includeChannelRoles
        ? channelRolesService.loadChannelRoles(this.channel).catch((error) =>
            log.error(
              LOG_CATEGORIES.INTEGRATION,
              "Failed to load channel roles",
              error,
            ),
          )
        : undefined,
    ]);
  }

  async refresh(
    options: ChatAssetOptions,
    cosmeticUsers: CosmeticRefreshUser[],
  ) {
    await Promise.all([
      emoteService.reloadEmotes(options.channelId, this.channel, {
        show7tvUnlisted: options.show7tvUnlisted,
      }),
      options.channelId
        ? badgeService.loadBadges(this.channel, options.channelId)
        : undefined,
      sevenTVCosmeticsService.reloadCosmetics(cosmeticUsers),
    ]);

    sevenTVEventApi.replacePaintCosmetics(
      sevenTVCosmeticsService.getCosmetics(),
      sevenTVCosmeticsService.getUserCosmetics(),
    );
  }

  async resolveReward(rewardId: string): Promise<TwitchGqlCustomReward | null> {
    if (!rewardId) return null;

    return new Promise<TwitchGqlCustomReward | null>((resolve) => {
      const timeout = window.setTimeout(
        () => resolve(null),
        REWARD_RESOLUTION_TIMEOUT_MS,
      );
      twitchGqlService
        .loadChannelPointRewards(this.channel)
        .then(
          (rewards) => resolve(rewards.get(rewardId) ?? null),
          () => resolve(null),
        )
        .finally(() => window.clearTimeout(timeout));
    });
  }
}
