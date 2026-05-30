import { parseChatConfigFromSearchParams } from "~/config/chatUrlParams";
import { fetchWithFallback, FALLBACK_APIS, TWITCH_CONFIG } from "~/config/twitch";
import { badgeService } from "~/services/badges";
import {
  ChatISIntegrationService,
  TwitchService,
  channelRolesService,
  colorService,
  createFromQueryParams,
  emoteService,
  mentionStyleService,
  twitchGqlService,
  v3Integration,
  type TwitchMessage,
} from "~/services/chat";
import {
  generateShadowStyles,
  generateSizeStyles,
  generateStrokeStyles,
  generateVariantStyles,
} from "~/styles/chatStyles";
import { extractEmojis } from "~/utils/chat/emojiUtils";
import {
  DEFAULT_ANIMATION_OPTIONS,
  messageSpeedToIntervalMs,
  updateAnimationStyles,
} from "~/utils/ui/animationUtils";
import { log, LOG_CATEGORIES } from "~/utils/logger";
import type { ChatConfig } from "~/utils/chat";

type MessageUpdater = (messages: TwitchMessage[]) => TwitchMessage[];

type LoadingState = {
  status: string;
  progress: number;
};

type ChannelResolution = {
  channelId: string;
  displayName: string;
};

type OverlayRuntimeHooks = {
  onConfigResolved: (config: ChatConfig) => void;
  onServiceReady: (service: ChatISIntegrationService) => void;
  onLoadingChange: (state: LoadingState) => void;
  onConnectionChange: (connected: boolean) => void;
  onMessagesChange: (updater: MessageUpdater) => void;
  onAnimationDurationChange: (durationMs: number) => void;
  onChannelResolved: (resolution: ChannelResolution) => void;
};

function getAdaptiveAnimationDuration(
  baseDuration: number,
  messagesPerSecond: number,
) {
  if (messagesPerSecond <= 6) return baseDuration;
  const scale = Math.max(0.38, 1 - (messagesPerSecond - 6) * 0.045);
  return Math.round(baseDuration * scale);
}

function removeMessageElements(selector: string, tracked: number[]) {
  const remove = () => {
    document.querySelectorAll(selector).forEach((element) => element.remove());
  };

  remove();
  setTrackedTimeout(tracked, remove, 200);
  setTrackedTimeout(tracked, remove, 1000);
}

function setTrackedTimeout(
  tracked: number[],
  callback: () => void,
  delay: number,
) {
  const id = window.setTimeout(() => {
    const index = tracked.indexOf(id);
    if (index >= 0) tracked.splice(index, 1);
    callback();
  }, delay);
  tracked.push(id);
  return id;
}

function isTwitchUserId(value: string): boolean {
  return /^\d+$/.test(value) && value !== "0";
}

export class OverlayRuntime {
  private readonly twitchService = new TwitchService();
  private readonly messageQueue: TwitchMessage[] = [];
  private readonly recentMessageTimes: number[] = [];
  private readonly styleElementIds = [
    "chat-size-styles",
    "chat-shadow-styles",
    "chat-stroke-styles",
    "chat-variant-styles",
    "chat-animations",
  ];

  private chatService: ChatISIntegrationService | null = null;
  private batchInterval: number | null = null;
  private readonly pendingTimers: number[] = [];
  private scrollContainer: HTMLElement | null = null;
  private scrollHandler: (() => void) | null = null;
  private initialized = false;
  private connected = false;
  private activeChannelId = "";
  private activeConfig: ChatConfig | null = null;
  private readonly eventHandlers = {
    messageDeleted: (event: Event) => {
      const customEvent = event as CustomEvent<{ messageId: string }>;
      const { messageId } = customEvent.detail;
      this.hooks.onMessagesChange((messages) =>
        messages.filter((message) => message.id !== messageId),
      );
    },
    userTimeout: (event: Event) => {
      const customEvent = event as CustomEvent<{ username: string }>;
      const username = customEvent.detail.username.toLowerCase();
      this.hooks.onMessagesChange((messages) =>
        messages.filter((message) => message.username.toLowerCase() !== username),
      );
    },
    userBanned: (event: Event) => {
      const customEvent = event as CustomEvent<{ username: string }>;
      const username = customEvent.detail.username.toLowerCase();
      this.hooks.onMessagesChange((messages) =>
        messages.filter((message) => message.username.toLowerCase() !== username),
      );
    },
    chatCleared: () => {
      log.debug(LOG_CATEGORIES.INTEGRATION, "Clearing all chat messages");
      this.hooks.onMessagesChange(() => []);
    },
    sevenTvEvent: (event: Event) => {
      const customEvent = event as CustomEvent<{ type: string }>;
      log.debug(
        LOG_CATEGORIES.INTEGRATION,
        `7TV Event: ${customEvent.detail.type}`,
      );

      if (customEvent.detail.type === "user.update") {
        log.info(
          LOG_CATEGORIES.INTEGRATION,
          "Reloading 7TV emotes due to set change",
        );
        void emoteService.reload7TVEmotes().catch((error) => {
          log.error(LOG_CATEGORIES.EMOTES, "Failed to reload 7TV emotes", error);
        });
      }
    },
  };

  constructor(
    private readonly channel: string,
    private readonly hooks: OverlayRuntimeHooks,
  ) {}

  getService() {
    return this.chatService;
  }

  async initialize(): Promise<void> {
    if (this.initialized || typeof window === "undefined") return;

    mentionStyleService.reset();

    this.setLoading("Инициализация чата...", 10);
    log.info(
      LOG_CATEGORIES.CHAT,
      `Chat overlay starting for channel: ${this.channel}`,
    );

    const urlParams = new URLSearchParams(window.location.search);
    const chatConfig = parseChatConfigFromSearchParams(urlParams, {
      channel: this.channel,
    });

    this.activeConfig = chatConfig;
    this.hooks.onConfigResolved(chatConfig);
    this.setLoading("Подготовка стилей...", 25);
    this.injectStyles(chatConfig);

    this.setLoading("Инициализация сервисов...", 35);
    const service = new ChatISIntegrationService(createFromQueryParams(chatConfig));
    this.chatService = service;
    this.hooks.onServiceReady(service);

    this.setLoading("Получение ID канала...", 45);
    const channelResolution = await this.resolveChannelIdentity();
    this.hooks.onChannelResolved(channelResolution);

    const hasChannelId = isTwitchUserId(channelResolution.channelId);
    const channelId = hasChannelId ? channelResolution.channelId : "";
    this.activeChannelId = channelId;
    log.info(
      LOG_CATEGORIES.CHAT,
      `Using identifier: ${channelId || this.channel} (${channelId ? "ID" : "name"})`,
    );

    this.setLoading("Загрузка баджей и эмоутов...", 55);
    await service.initialize(this.channel, channelId);

    if (channelId) {
      this.setLoading("Подключение 7TV EventAPI...", 70);
      await v3Integration.initialize(channelId).catch((error) => {
        log.error(LOG_CATEGORIES.INTEGRATION, "Failed to initialize V3 Integration", error);
        log.error(
          LOG_CATEGORIES.INTEGRATION,
          "Failed to initialize V3 Integration:",
          error,
        );
      });
    }

    this.initializeLayout(service);

    this.setLoading("Фоновая загрузка данных...", 85);
    void Promise.all([
      channelId
        ? badgeService
            .loadBadges(this.channel, channelId)
            .catch((error) => log.error(LOG_CATEGORIES.BADGE, "Failed to load badges", error))
        : undefined,
      channelId
        ? colorService
            .loadCosmetics(channelId)
            .catch((error) =>
              log.error(LOG_CATEGORIES.PAINTS, "Failed to load cosmetics", error),
            )
        : undefined,
      emoteService
        .loadEmotes(channelId, this.channel, {
          show7tvUnlisted: chatConfig.show7tvUnlisted,
        })
        .catch((error) => log.error(LOG_CATEGORIES.EMOTES, "Failed to load emotes", error)),
      channelRolesService
        .loadChannelRoles(this.channel)
        .catch((error) =>
          log.error(LOG_CATEGORIES.INTEGRATION, "Failed to load channel roles", error),
        ),
    ]);

    this.setupEventListeners();
    this.startBatchProcessing();

    this.setLoading("Подключение к Twitch IRC...", 95);
    this.connectToTwitch();
    this.initialized = true;
    log.info(LOG_CATEGORIES.CHAT, "Chat overlay initialized");
  }

  destroy() {
    if (this.scrollContainer && this.scrollHandler) {
      this.scrollContainer.removeEventListener("scroll", this.scrollHandler);
    }
    if (this.batchInterval !== null) {
      window.clearInterval(this.batchInterval);
    }
    for (const id of this.pendingTimers) window.clearTimeout(id);
    this.pendingTimers.length = 0;
    this.messageQueue.length = 0;
    this.removeEventListeners();
    this.twitchService.disconnect();
    v3Integration.destroy();
    this.chatService?.cleanup();
    this.chatService = null;
    this.connected = false;
    this.initialized = false;
  }

  private setLoading(status: string, progress: number) {
    this.hooks.onLoadingChange({ status, progress });
  }

  private injectStyles(config: ChatConfig) {
    this.cleanupStyleElements();

    const sizeStyleElement = document.createElement("style");
    sizeStyleElement.id = "chat-size-styles";
    sizeStyleElement.innerHTML = generateSizeStyles(config.size as 1 | 2 | 3);
    document.head.appendChild(sizeStyleElement);

    if (config.shadow) {
      const shadowStyleElement = document.createElement("style");
      shadowStyleElement.id = "chat-shadow-styles";
      shadowStyleElement.innerHTML = generateShadowStyles(
        config.shadow as 1 | 2 | 3,
      );
      document.head.appendChild(shadowStyleElement);
    }

    if (config.stroke) {
      const strokeStyleElement = document.createElement("style");
      strokeStyleElement.id = "chat-stroke-styles";
      strokeStyleElement.innerHTML = generateStrokeStyles(
        config.stroke as 1 | 2 | 3 | 4,
      );
      document.head.appendChild(strokeStyleElement);
    }

    const variantStyles = generateVariantStyles(config);
    if (variantStyles) {
      const variantStyleElement = document.createElement("style");
      variantStyleElement.id = "chat-variant-styles";
      variantStyleElement.innerHTML = variantStyles;
      document.head.appendChild(variantStyleElement);
    }

    if (config.animate) {
      updateAnimationStyles({
        enabled: true,
        duration: DEFAULT_ANIMATION_OPTIONS.duration,
        easing: "ease-out",
        type: "fade",
      });
    }
  }

  private cleanupStyleElements() {
    this.styleElementIds.forEach((id) => document.getElementById(id)?.remove());
  }

  private initializeLayout(service: ChatISIntegrationService) {
    const container = document.getElementById("chat_container");
    if (!container) return;

    this.scrollContainer = container;
    this.scrollHandler = () => service.handleUserScroll();
    container.addEventListener("scroll", this.scrollHandler, { passive: true });
    service.initializeLayout(container);
  }

  private startBatchProcessing() {
    const batchIntervalMs = this.activeConfig
      ? messageSpeedToIntervalMs(this.activeConfig.messageSpeed)
      : DEFAULT_ANIMATION_OPTIONS.duration;

    if (batchIntervalMs === null) return;

    this.batchInterval = window.setInterval(() => {
      if (this.messageQueue.length === 0) return;

      const batch = this.messageQueue.splice(0, this.messageQueue.length);

      this.hooks.onMessagesChange((messages) => {
        const nextMessages = [...messages, ...batch];
        return nextMessages.length > 100
          ? nextMessages.slice(-100)
          : nextMessages;
      });

      const now = Date.now();
      for (let index = 0; index < batch.length; index += 1) {
        this.recentMessageTimes.push(now);
      }
      while (
        this.recentMessageTimes.length > 0 &&
        now - this.recentMessageTimes[0] > 1000
      ) {
        this.recentMessageTimes.shift();
      }

      const baseAnimationDuration =
        this.chatService?.getConfig().animation.duration ?? 380;
      this.hooks.onAnimationDurationChange(
        getAdaptiveAnimationDuration(
          baseAnimationDuration,
          this.recentMessageTimes.length,
        ),
      );

      if (!this.chatService || !this.activeConfig) return;

      setTrackedTimeout(this.pendingTimers, () => {
        batch.forEach((message) => {
          const messageElement = document.querySelector(
            `[data-id="${message.id}"]`,
          ) as HTMLElement | null;
          if (messageElement?.isConnected) {
            this.chatService?.scheduleMessageFade(messageElement, () => {
              this.hooks.onMessagesChange((messages) =>
                messages.filter((entry) => entry.id !== message.id),
              );
              messageElement.remove();
            });
          }
        });
      }, 100);

      this.chatService.scrollToLatest(this.activeConfig.animate);
    }, batchIntervalMs);
  }

  private setupEventListeners() {
    window.addEventListener(
      "chatis:message-deleted",
      this.eventHandlers.messageDeleted,
    );
    window.addEventListener("chatis:user-timeout", this.eventHandlers.userTimeout);
    window.addEventListener("chatis:user-banned", this.eventHandlers.userBanned);
    window.addEventListener("chatis:chat-cleared", this.eventHandlers.chatCleared);
    window.addEventListener("chatis:7tv-event", this.eventHandlers.sevenTvEvent);
  }

  private removeEventListeners() {
    window.removeEventListener(
      "chatis:message-deleted",
      this.eventHandlers.messageDeleted,
    );
    window.removeEventListener("chatis:user-timeout", this.eventHandlers.userTimeout);
    window.removeEventListener("chatis:user-banned", this.eventHandlers.userBanned);
    window.removeEventListener("chatis:chat-cleared", this.eventHandlers.chatCleared);
    window.removeEventListener("chatis:7tv-event", this.eventHandlers.sevenTvEvent);
  }

  private async resolveChannelIdentity(): Promise<ChannelResolution> {
    try {
      const response = await fetchWithFallback(
        `${TWITCH_CONFIG.API_BASE_URL}/users?login=${encodeURIComponent(this.channel)}`,
        FALLBACK_APIS.user_info(this.channel),
      );

      if (!response.ok) {
        log.warn(LOG_CATEGORIES.TWITCH_IRC, "Failed to get channel ID, using channel name as fallback");
        return { channelId: "", displayName: "" };
      }

      const data = await response.json();
      const pickDisplayName = (entry: any) =>
        entry?.display_name || entry?.displayName || entry?.login || "";

      if (data.data?.[0]?.id) {
        return {
          channelId: data.data[0].id,
          displayName: pickDisplayName(data.data[0]),
        };
      }

      if (Array.isArray(data) && data[0]?.id) {
        return {
          channelId: data[0].id,
          displayName: pickDisplayName(data[0]),
        };
      }

      log.warn(LOG_CATEGORIES.TWITCH_IRC, "Unexpected API response format, using channel name as fallback");
      return { channelId: "", displayName: "" };
    } catch (error) {
      log.warn(LOG_CATEGORIES.TWITCH_IRC, "Failed to get channel ID, using channel name as fallback", error,
      );
      return { channelId: "", displayName: "" };
    }
  }

  private connectToTwitch() {
    if (this.connected || this.twitchService.isConnected()) return;

    log.info(LOG_CATEGORIES.TWITCH_IRC, `Connecting to channel: ${this.channel}`);

    this.twitchService.connect(
      this.channel,
      async (message) => {
        if (!this.activeConfig || !this.chatService) return;
        if (messageSpeedToIntervalMs(this.activeConfig.messageSpeed) === null) {
          return;
        }

        if (
          !this.chatService.shouldDisplayMessage(message.username, message.message)
        ) {
          return;
        }

        const userId = message.userId || "0";
        const gqlSender = await this.resolveGqlSender(userId);
        if (gqlSender) {
          message.displayName = gqlSender.displayName || message.displayName;
          message.color = gqlSender.chatColor || message.color;
          this.mergeGqlBadges(message, gqlSender.displayBadges);
        }

        void badgeService.loadUserBadges(message.username, userId).catch(() => {});
        mentionStyleService.registerMessageAuthor(message);

        message.emoteSnapshot = this.createMessageEmoteSnapshot(message);

        this.messageQueue.push(message);
      },
      () => {
        this.connected = true;
        this.hooks.onConnectionChange(true);
        this.setLoading("Готово!", 100);
      },
      () => {
        this.connected = false;
        this.hooks.onConnectionChange(false);
      },
      (messageId) => {
        log.debug(LOG_CATEGORIES.CHAT, `Deleting message: ${messageId}`);
        this.hooks.onMessagesChange((messages) =>
          messages.filter((message) => message.id !== messageId),
        );
        removeMessageElements(`[data-id="${messageId}"]`, this.pendingTimers);
      },
      (username) => {
        log.debug(LOG_CATEGORIES.CHAT, `Clearing chat for user: ${username}`);
        this.hooks.onMessagesChange((messages) =>
          messages.filter(
            (message) =>
              message.username.toLowerCase() !== username.toLowerCase(),
          ),
        );
        removeMessageElements(`[data-nick="${username}"]`, this.pendingTimers);
      },
      () => {
        log.debug(LOG_CATEGORIES.CHAT, "Clearing all chat messages");
        this.hooks.onMessagesChange(() => []);
      },
    );

    log.info(LOG_CATEGORIES.TWITCH_IRC, "Twitch IRC connection initialized");
  }

  private createMessageEmoteSnapshot(message: TwitchMessage) {
    const snapshot = new Map<string, any>();

    if (!this.chatService) {
      return snapshot;
    }

    const parts = message.message.split(/(\s+)/);
    for (const part of parts) {
      if (!part || /^\s+$/.test(part)) continue;

      const [withPlaceholders] = extractEmojis(part);
      const emoteName = withPlaceholders.replace(/__EMOJI\d+__/g, "");
      if (!emoteName) continue;

      const emote = this.chatService.getEmote(emoteName, message.username);
      if (emote) {
        snapshot.set(emoteName, { ...emote });
      }
    }

    return snapshot;
  }

  private async resolveGqlSender(userId: string) {
    if (!this.activeChannelId || !userId || userId === "0") return null;

    return new Promise<Awaited<ReturnType<typeof twitchGqlService.loadSender>>>(
      (resolve) => {
        const timeout = window.setTimeout(() => resolve(null), 350);
        twitchGqlService
          .loadSender(this.activeChannelId, userId)
          .then(resolve, () => resolve(null))
          .finally(() => window.clearTimeout(timeout));
      },
    );
  }

  private mergeGqlBadges(
    message: TwitchMessage,
    badges: Array<{ setID?: string; setId?: string; version?: string }>,
  ) {
    const existing = new Set(message.badges);

    for (const badge of badges) {
      const setId = badge.setID || badge.setId || "";
      const version = badge.version || "";
      if (!setId || !version) continue;

      existing.add(`${setId}/${version}`);
    }

    message.badges = [...existing];
  }
}
