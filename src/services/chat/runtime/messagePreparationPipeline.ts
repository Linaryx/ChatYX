import type { ChatConfig } from "~/config/chatUrlParams";
import { badgeService } from "~/services/badges";
import { createMessageTokenSnapshot } from "~/utils/chat/emojiUtils";
import { mergeBadgesBySetId } from "~/utils/chat/senderIdentity";
import type { ChatPresentationService } from "../chatPresentationService";
import { mentionStyleService } from "../mentionStyleService";
import type { TwitchMessage } from "../twitchService";
import type { AnnouncementColorResolver } from "./announcementColorResolver";
import type { ChatAssetLoader } from "./chatAssetLoader";

type MessageRefreshPatch = Partial<
  Pick<
    TwitchMessage,
    | "sourceChannelLogin"
    | "sourceChannelDisplayName"
    | "sourceChannelAvatarUrl"
    | "showSourceChannelBadge"
  >
>;

type MessagePreparationPipelineOptions = {
  announcementColorResolver: AnnouncementColorResolver;
  assetLoader: ChatAssetLoader;
  getConfig: () => ChatConfig | null;
  getService: () => ChatPresentationService | null;
  onMessageRefresh: (
    messageId: string,
    patch?: MessageRefreshPatch,
  ) => void;
};

export class MessagePreparationPipeline {
  private readonly seenMessageIds = new Set<string>();
  private readonly inFlightMessages = new Set<TwitchMessage>();
  private readonly canceledMessages = new WeakSet<TwitchMessage>();
  private readonly channelMessages = new Map<string, TwitchMessage>();
  private readonly observedChannelIds = new Set<string>();
  private channelBadgesVisible = false;
  private preparationGeneration = 0;

  constructor(private readonly options: MessagePreparationPipelineOptions) {}

  async prepare(message: TwitchMessage): Promise<TwitchMessage | null> {
    const config = this.options.getConfig();
    const service = this.options.getService();
    if (!config || !service || this.isDuplicate(message)) return null;

    if (!service.shouldDisplayMessage(message.username, message.message)) {
      return null;
    }

    const generation = this.preparationGeneration;
    this.inFlightMessages.add(message);
    this.remember(message);

    try {
      const userId = message.userId || "0";
      message.badges = mergeBadgesBySetId(message.badges, []);

      if (message.customRewardId) {
        const reward = await this.options.assetLoader.resolveReward(
          message.customRewardId,
        );
        if (reward) {
          message.channelPointReward = reward;
          const isGigantifiedReward = reward.prompt
            .toUpperCase()
            .includes("FFZ:GE");
          if (isGigantifiedReward || message.twitchEvent?.type === "power-up") {
            message.isGigantifiedEmote = true;
            if (message.twitchEvent?.type !== "power-up") {
              message.twitchEvent = {
                type: "power-up",
                label: "Гигантский эмоут",
              };
            }
          } else {
            message.twitchEvent = {
              type: "reward",
              label: "Награда",
              detail: reward.title,
              count: reward.cost,
            };
          }
        }
      }

      if (!this.isStillActive(message, generation)) return null;
      await this.options.announcementColorResolver.apply(message);
      if (!this.isStillActive(message, generation)) return null;

      mentionStyleService.registerMessageAuthor(message);

      message.tokenSnapshot = createMessageTokenSnapshot(message.message);
      const serviceSnapshot = this.createEmoteSnapshot(message, service);
      message.emoteSnapshot = new Map([
        ...serviceSnapshot,
        ...(message.emoteSnapshot ?? new Map<string, any>()),
      ]);

      if (message.platform !== "youtube") {
        this.loadUserBadges(message, userId);
        this.registerChannelMessage(message);
      }

      return message;
    } finally {
      this.inFlightMessages.delete(message);
    }
  }

  refresh(message: TwitchMessage): TwitchMessage {
    const tokenSnapshot = createMessageTokenSnapshot(message.message);
    const service = this.options.getService();
    const serviceSnapshot = service
      ? this.createEmoteSnapshot({ ...message, tokenSnapshot }, service)
      : new Map<string, any>();
    const platformSnapshot =
      message.platform === "youtube"
        ? message.emoteSnapshot ?? new Map<string, any>()
        : new Map<string, any>();

    return {
      ...message,
      tokenSnapshot,
      emoteSnapshot: new Map([...serviceSnapshot, ...platformSnapshot]),
    };
  }

  clear() {
    this.cancelPending();
    this.seenMessageIds.clear();
    this.channelMessages.clear();
    this.observedChannelIds.clear();
    this.channelBadgesVisible = false;
  }

  cancelMessage(messageId: string) {
    this.cancelWhere((message) => message.id === messageId);
  }

  cancelUser(username: string) {
    const normalizedUsername = username.toLowerCase();
    this.cancelWhere(
      (message) => message.username.toLowerCase() === normalizedUsername,
    );
  }

  cancelUserId(userId: string) {
    this.cancelWhere((message) => message.userId === userId);
  }

  cancelPending() {
    this.preparationGeneration += 1;
    this.inFlightMessages.clear();
  }

  private loadUserBadges(message: TwitchMessage, userId: string) {
    if (!message.id) return;

    const messageId = message.id;
    void badgeService
      .loadUserBadges(message.username, userId)
      .then((badges) => {
        if (
          badges.length === 0 ||
          !this.options.getService() ||
          !this.seenMessageIds.has(messageId)
        ) {
          return;
        }
        this.options.onMessageRefresh(messageId);
      })
      .catch(() => {});
  }

  private registerChannelMessage(message: TwitchMessage) {
    const channelId = message.sourceChannelId || message.targetChannelId;
    if (!message.id || !channelId) return;

    this.channelMessages.set(message.id, message);
    this.observedChannelIds.add(channelId);

    if (!this.channelBadgesVisible && this.observedChannelIds.size > 1) {
      this.channelBadgesVisible = true;
      for (const trackedMessage of this.channelMessages.values()) {
        trackedMessage.showSourceChannelBadge = true;
        this.options.onMessageRefresh(trackedMessage.id, {
          showSourceChannelBadge: true,
        });
      }
    } else if (this.channelBadgesVisible) {
      message.showSourceChannelBadge = true;
    }

    const messageId = message.id;
    void this.options.assetLoader
      .loadSharedChannel(channelId)
      .then((profile) => {
        if (!this.options.getService() || !this.seenMessageIds.has(messageId)) {
          return;
        }

        const patch: MessageRefreshPatch = {};
        if (profile) {
          message.sourceChannelLogin = profile.login;
          message.sourceChannelDisplayName = profile.displayName;
          message.sourceChannelAvatarUrl = profile.profileImageUrl;
          patch.sourceChannelLogin = profile.login;
          patch.sourceChannelDisplayName = profile.displayName;
          patch.sourceChannelAvatarUrl = profile.profileImageUrl;
        }
        this.options.onMessageRefresh(messageId, patch);
      })
      .catch(() => {});
  }

  private isDuplicate(message: TwitchMessage) {
    return Boolean(message.id && this.seenMessageIds.has(message.id));
  }

  private isStillActive(message: TwitchMessage, generation: number) {
    return (
      generation === this.preparationGeneration &&
      !this.canceledMessages.has(message) &&
      Boolean(this.options.getService())
    );
  }

  private cancelWhere(predicate: (message: TwitchMessage) => boolean) {
    for (const message of this.inFlightMessages) {
      if (predicate(message)) this.canceledMessages.add(message);
    }
  }

  private remember(message: TwitchMessage) {
    if (!message.id) return;

    this.seenMessageIds.add(message.id);
    if (this.seenMessageIds.size <= 300) return;

    const oldest = this.seenMessageIds.values().next().value as string | undefined;
    if (oldest) {
      this.seenMessageIds.delete(oldest);
      this.channelMessages.delete(oldest);
    }
  }

  private createEmoteSnapshot(
    message: TwitchMessage,
    service: ChatPresentationService,
  ) {
    const snapshot = new Map<string, any>();
    const tokenSnapshot =
      message.tokenSnapshot?.source === message.message
        ? message.tokenSnapshot
        : createMessageTokenSnapshot(message.message);

    for (const token of tokenSnapshot.tokens) {
      if (!token.raw || token.isWhitespace) continue;

      const emoteName = token.cleanText;
      if (!emoteName) continue;

      const emote = service.getEmote(
        emoteName,
        message.username,
        message.sourceChannelId,
      );
      if (emote) snapshot.set(emoteName, { ...emote });
    }

    return snapshot;
  }
}
