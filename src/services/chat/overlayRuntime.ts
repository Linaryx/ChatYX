import { parseChatConfigFromSearchParams } from "~/config/chatUrlParams";
import { fetchWithFallback, FALLBACK_APIS, TWITCH_CONFIG } from "~/config/twitch";
import { badgeService } from "~/services/badges";
import {
  ChatPresentationService,
  TwitchService,
  YouTubeChatService,
  channelRolesService,
  createChatPresentationConfig,
  emoteService,
  mentionStyleService,
  sevenTVCosmeticsService,
  sevenTVEventApi,
  twitchGqlService,
  chatFeatureIntegration,
  type TwitchGqlCustomReward,
  type TwitchMessage,
} from "~/services/chat";
import { fetchRecentMessages } from "~/services/chat/recentMessagesService";
import {
  generateShadowStyles,
  generateSizeStyles,
  generateStrokeStyles,
  generateVariantStyles,
} from "~/styles/chatStyles";
import { createMessageTokenSnapshot } from "~/utils/chat/emojiUtils";
import {
  DEFAULT_ANIMATION_OPTIONS,
  updateAnimationStyles,
} from "~/utils/ui/animationUtils";
import { log, LOG_CATEGORIES } from "~/utils/logger";
import {
  mergeBadgesBySetId,
  resolveSenderIdentity,
} from "~/utils/chat/senderIdentity";
import type { ChatConfig } from "~/utils/chat";
import {
  ChatCommandFeedback,
  CHATYX_DEVELOPER_CHANNEL,
  getAuthorizedChatCommand,
  isDeveloperChatMessage,
  parseTestMessageCount,
} from "./chatCommandService";

type MessageUpdater = (messages: TwitchMessage[]) => TwitchMessage[];
type MessageRefreshPatch = Partial<
  Pick<TwitchMessage, "displayName" | "color" | "badges">
>;

type LoadingState = {
  status: string;
  progress: number;
};

type ChannelResolution = {
  channelId: string;
  displayName: string;
};

const RECENT_MESSAGE_LIMIT = 15;

type OverlayRuntimeHooks = {
  onConfigResolved: (config: ChatConfig) => void;
  onServiceReady: (service: ChatPresentationService) => void;
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
  private readonly youtubeService = new YouTubeChatService();
  private readonly commandFeedback = new ChatCommandFeedback();
  private readonly recentMessageTimes: number[] = [];
  private readonly seenMessageIds = new Set<string>();
  private readonly styleElementIds = [
    "chat-size-styles",
    "chat-shadow-styles",
    "chat-stroke-styles",
    "chat-variant-styles",
    "chat-animations",
  ];

  private chatService: ChatPresentationService | null = null;
  private readonly pendingTimers: number[] = [];
  private readonly pendingMessages: TwitchMessage[] = [];
  private readonly pendingMessageRefreshes = new Map<
    string,
    MessageRefreshPatch
  >();
  private pendingMessageFrame: number | null = null;
  private pendingMessageRefreshFrame: number | null = null;
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
      this.discardPendingMessages((message) => message.id === messageId);
      this.hooks.onMessagesChange((messages) =>
        messages.filter((message) => message.id !== messageId),
      );
    },
    userTimeout: (event: Event) => {
      const customEvent = event as CustomEvent<{ username: string }>;
      const username = customEvent.detail.username.toLowerCase();
      this.discardPendingMessages(
        (message) => message.username.toLowerCase() === username,
      );
      this.hooks.onMessagesChange((messages) =>
        messages.filter((message) => message.username.toLowerCase() !== username),
      );
    },
    userBanned: (event: Event) => {
      const customEvent = event as CustomEvent<{ username: string }>;
      const username = customEvent.detail.username.toLowerCase();
      this.discardPendingMessages(
        (message) => message.username.toLowerCase() === username,
      );
      this.hooks.onMessagesChange((messages) =>
        messages.filter((message) => message.username.toLowerCase() !== username),
      );
    },
    chatCleared: () => {
      log.debug(LOG_CATEGORIES.INTEGRATION, "Clearing all chat messages");
      this.clearPendingMessages();
      this.clearPendingMessageRefreshes();
      this.hooks.onMessagesChange(() => []);
    },
    sevenTvEvent: (event: Event) => {
      const customEvent = event as CustomEvent<{ type: string }>;
      const eventType = customEvent.detail.type;
      log.debug(
        LOG_CATEGORIES.INTEGRATION,
        `7TV Event: ${eventType}`,
      );

      if (eventType.startsWith("cosmetic.") || eventType.startsWith("entitlement.")) {
        this.chatService?.clearPaintCache();
      }

      if (eventType === "user.update") {
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
    const hasTwitchChannel = Boolean(this.channel.trim());

    this.activeConfig = chatConfig;
    this.hooks.onConfigResolved(chatConfig);
    this.setLoading("Подготовка стилей...", 25);
    this.injectStyles(chatConfig);

    this.setLoading("Инициализация сервисов...", 35);
    const service = new ChatPresentationService(
      createChatPresentationConfig(chatConfig),
    );
    this.chatService = service;
    this.hooks.onServiceReady(service);

    this.setLoading(
      hasTwitchChannel ? "Получение ID канала..." : "Подготовка YouTube...",
      45,
    );
    const channelResolution = hasTwitchChannel
      ? await this.resolveChannelIdentity()
      : { channelId: "", displayName: "" };
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
      await chatFeatureIntegration.initialize(channelId).catch((error) => {
        log.error(LOG_CATEGORIES.INTEGRATION, "Failed to initialize chat feature integration", error);
        log.error(
          LOG_CATEGORIES.INTEGRATION,
          "Failed to initialize chat feature integration:",
          error,
        );
      });
    }

    this.initializeLayout(service);

    if (hasTwitchChannel) {
      void twitchGqlService
        .loadChannelPointRewards(this.channel)
        .catch(() => {});
    }

    this.setLoading(
      chatConfig.recentMessages && hasTwitchChannel
        ? "Загрузка последних сообщений..."
        : "Пропуск последних сообщений...",
      82,
    );
    const loadedRecentMessages = chatConfig.recentMessages && hasTwitchChannel
      ? await this.loadRecentMessages()
      : 0;

    this.setLoading("Фоновая загрузка данных...", 85);
    void Promise.all([
      channelId
        ? badgeService
            .loadBadges(this.channel, channelId)
            .catch((error) => log.error(LOG_CATEGORIES.BADGE, "Failed to load badges", error))
        : undefined,
      channelId
        ? sevenTVCosmeticsService
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
      hasTwitchChannel
        ? channelRolesService
            .loadChannelRoles(this.channel)
            .catch((error) =>
              log.error(LOG_CATEGORIES.INTEGRATION, "Failed to load channel roles", error),
            )
        : undefined,
    ]);

    this.setupEventListeners();

    this.setLoading(
      hasTwitchChannel ? "Подключение к Twitch IRC..." : "Подключение к YouTube...",
      95,
    );
    if (loadedRecentMessages > 0) {
      this.setLoading("Подключение к Twitch IRC...", 100);
    }
    if (hasTwitchChannel) {
      this.connectToTwitch();
    }
    this.connectToYouTube();
    this.initialized = true;
    log.info(LOG_CATEGORIES.CHAT, "Chat overlay initialized");
  }

  destroy() {
    if (this.scrollContainer && this.scrollHandler) {
      this.scrollContainer.removeEventListener("scroll", this.scrollHandler);
    }
    for (const id of this.pendingTimers) window.clearTimeout(id);
    this.pendingTimers.length = 0;
    this.clearPendingMessages();
    this.clearPendingMessageRefreshes();
    this.recentMessageTimes.length = 0;
    this.seenMessageIds.clear();
    this.removeEventListeners();
    this.twitchService.disconnect();
    this.youtubeService.disconnect();
    this.commandFeedback.destroy();
    chatFeatureIntegration.destroy();
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

  private initializeLayout(service: ChatPresentationService) {
    const container = document.getElementById("chat_container");
    if (!container) return;

    this.scrollContainer = container;
    this.scrollHandler = () => service.handleUserScroll();
    container.addEventListener("scroll", this.scrollHandler, { passive: true });
    service.initializeLayout(container);
  }

  private appendMessage(message: TwitchMessage) {
    if (!this.chatService || !this.activeConfig) return;

    const now = Date.now();
    this.recentMessageTimes.push(now);
    while (
      this.recentMessageTimes.length > 0 &&
      now - this.recentMessageTimes[0] > 1000
    ) {
      this.recentMessageTimes.shift();
    }

    this.pendingMessages.push(message);
    if (this.pendingMessageFrame !== null) return;

    this.pendingMessageFrame = window.requestAnimationFrame(() => {
      this.pendingMessageFrame = null;
      const batch = this.pendingMessages.splice(0);
      if (batch.length === 0) return;

      this.hooks.onMessagesChange((messages) => {
        const nextMessages = [...messages, ...batch];
        return nextMessages.length > 100 ? nextMessages.slice(-100) : nextMessages;
      });

      const baseAnimationDuration =
        this.chatService?.getConfig().animation.duration ?? 380;
      this.hooks.onAnimationDurationChange(
        getAdaptiveAnimationDuration(
          baseAnimationDuration,
          this.recentMessageTimes.length,
        ),
      );

      if (this.chatService && this.activeConfig) {
        this.chatService.scrollToLatest(this.activeConfig.animate);
      }
    });
  }

  private discardPendingMessages(predicate: (message: TwitchMessage) => boolean) {
    for (let index = this.pendingMessages.length - 1; index >= 0; index -= 1) {
      if (predicate(this.pendingMessages[index])) {
        this.pendingMessages.splice(index, 1);
      }
    }

    if (this.pendingMessages.length === 0 && this.pendingMessageFrame !== null) {
      window.cancelAnimationFrame(this.pendingMessageFrame);
      this.pendingMessageFrame = null;
    }
  }

  private clearPendingMessages() {
    this.pendingMessages.length = 0;
    if (this.pendingMessageFrame !== null) {
      window.cancelAnimationFrame(this.pendingMessageFrame);
      this.pendingMessageFrame = null;
    }
  }

  private queueMessageRefresh(
    messageId: string,
    patch: MessageRefreshPatch = {},
  ) {
    const existingPatch = this.pendingMessageRefreshes.get(messageId) ?? {};
    this.pendingMessageRefreshes.set(messageId, {
      ...existingPatch,
      ...patch,
    });

    if (this.pendingMessageRefreshFrame !== null) return;

    this.pendingMessageRefreshFrame = window.requestAnimationFrame(() => {
      this.pendingMessageRefreshFrame = null;
      const refreshes = new Map(this.pendingMessageRefreshes);
      this.pendingMessageRefreshes.clear();
      if (refreshes.size === 0) return;

      this.hooks.onMessagesChange((messages) => {
        let changed = false;
        const nextMessages = messages.map((message) => {
          if (!refreshes.has(message.id)) return message;

          changed = true;
          return {
            ...message,
            ...refreshes.get(message.id),
          };
        });
        return changed ? nextMessages : messages;
      });
    });
  }

  private clearPendingMessageRefreshes() {
    this.pendingMessageRefreshes.clear();
    if (this.pendingMessageRefreshFrame !== null) {
      window.cancelAnimationFrame(this.pendingMessageRefreshFrame);
      this.pendingMessageRefreshFrame = null;
    }
  }

  private setupEventListeners() {
    window.addEventListener(
      "chatyx:message-deleted",
      this.eventHandlers.messageDeleted,
    );
    window.addEventListener("chatyx:user-timeout", this.eventHandlers.userTimeout);
    window.addEventListener("chatyx:user-banned", this.eventHandlers.userBanned);
    window.addEventListener("chatyx:chat-cleared", this.eventHandlers.chatCleared);
    window.addEventListener("chatyx:7tv-event", this.eventHandlers.sevenTvEvent);
  }

  private removeEventListeners() {
    window.removeEventListener(
      "chatyx:message-deleted",
      this.eventHandlers.messageDeleted,
    );
    window.removeEventListener("chatyx:user-timeout", this.eventHandlers.userTimeout);
    window.removeEventListener("chatyx:user-banned", this.eventHandlers.userBanned);
    window.removeEventListener("chatyx:chat-cleared", this.eventHandlers.chatCleared);
    window.removeEventListener("chatyx:7tv-event", this.eventHandlers.sevenTvEvent);
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
        if (!this.activeConfig) return;

        this.handleChatCommand(message);
        if (isDeveloperChatMessage(message, this.channel)) return;
        const preparedMessage = await this.prepareMessageForDisplay(message);
        if (preparedMessage) this.appendMessage(preparedMessage);
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
        this.discardPendingMessages((message) => message.id === messageId);
        this.hooks.onMessagesChange((messages) =>
          messages.filter((message) => message.id !== messageId),
        );
        removeMessageElements(`[data-id="${messageId}"]`, this.pendingTimers);
      },
      (username) => {
        log.debug(LOG_CATEGORIES.CHAT, `Clearing chat for user: ${username}`);
        this.discardPendingMessages(
          (message) =>
            message.username.toLowerCase() === username.toLowerCase(),
        );
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
        this.clearPendingMessages();
        this.clearPendingMessageRefreshes();
        this.hooks.onMessagesChange(() => []);
      },
      [CHATYX_DEVELOPER_CHANNEL],
    );

    log.info(LOG_CATEGORIES.TWITCH_IRC, "Twitch IRC connection initialized");
  }

  private handleChatCommand(message: TwitchMessage): void {
    const command = getAuthorizedChatCommand(message, this.channel);
    if (!command || !this.activeConfig) return;

    log.info(
      LOG_CATEGORIES.CHAT,
      `Chat command ${command.name} from ${message.username}`,
    );

    switch (command.name) {
      case "refresh": {
        const visibleMessages = this.captureVisibleMessages();
        const cosmeticUsers = [...visibleMessages, ...this.pendingMessages]
          .filter((entry) => entry.platform !== "youtube" && entry.userId)
          .map((entry) => ({
            username: entry.username,
            userId: entry.userId || "",
          }));
        if (this.activeChannelId) {
          cosmeticUsers.push({
            username: this.channel,
            userId: this.activeChannelId,
          });
        }

        void Promise.all([
          emoteService.reloadEmotes(
            this.activeChannelId,
            this.channel,
            { show7tvUnlisted: this.activeConfig.show7tvUnlisted },
          ),
          this.activeChannelId
            ? badgeService.loadBadges(this.channel, this.activeChannelId)
            : undefined,
          sevenTVCosmeticsService.reloadCosmetics(cosmeticUsers),
        ])
          .then(() => {
            sevenTVEventApi.replacePaintCosmetics(
              sevenTVCosmeticsService.getCosmetics(),
              sevenTVCosmeticsService.getUserCosmetics(),
            );
            this.chatService?.clearPaintCache();
            this.refreshRenderedMessages();
            this.commandFeedback.showNotice(
              "ChatYX: эмоуты и 7TV-косметика обновлены",
            );
          })
          .catch((error) => {
            log.error(LOG_CATEGORIES.CHAT, "Failed to refresh chat assets", error);
            this.commandFeedback.showNotice("ChatYX: не удалось обновить данные");
          });
        break;
      }
      case "reload":
        window.location.reload();
        break;
      case "show": {
        const container = document.getElementById("chat_container");
        if (container) container.style.display = "";
        break;
      }
      case "hide": {
        const container = document.getElementById("chat_container");
        if (container) container.style.display = "none";
        break;
      }
      case "clear":
        this.clearPendingMessages();
        this.clearPendingMessageRefreshes();
        this.hooks.onMessagesChange(() => []);
        break;
      case "ping":
        this.commandFeedback.showNotice("Pong! ChatYX работает");
        break;
      case "test":
        this.appendTestMessages(message, parseTestMessageCount(command.args));
        break;
    }
  }

  private appendTestMessages(source: TwitchMessage, count: number): void {
    const samples = [
      "Тестовое сообщение ChatYX",
      "Проверяем длинную строку, переносы и скорость появления сообщений",
      "Kappa Keepo PogChamp",
      "@moderator команда работает",
    ];

    for (let index = 0; index < count; index += 1) {
      const message: TwitchMessage = {
        ...source,
        id: `chatyx-test-${Date.now()}-${index}`,
        username: `chatyx_test_${index + 1}`,
        displayName: `ChatYX Test ${index + 1}`,
        message: samples[index % samples.length],
        badges: [],
        emotes: {},
        isModerator: false,
        isSubscriber: false,
        timestamp: new Date(),
        userId: undefined,
        reply: undefined,
        tokenSnapshot: undefined,
        emoteSnapshot: undefined,
      };

      void this.prepareMessageForDisplay(message).then((prepared) => {
        if (prepared) this.appendMessage(prepared);
      });
    }
  }

  private captureVisibleMessages(): TwitchMessage[] {
    let snapshot: TwitchMessage[] = [];
    this.hooks.onMessagesChange((messages) => {
      snapshot = messages;
      return messages;
    });
    return snapshot;
  }

  private refreshRenderedMessages(): void {
    const refresh = (message: TwitchMessage): TwitchMessage => {
      const tokenSnapshot = createMessageTokenSnapshot(message.message);
      const serviceSnapshot = this.createMessageEmoteSnapshot({
        ...message,
        tokenSnapshot,
      });
      const platformSnapshot =
        message.platform === "youtube"
          ? message.emoteSnapshot ?? new Map<string, any>()
          : new Map<string, any>();

      return {
        ...message,
        tokenSnapshot,
        emoteSnapshot: new Map([...serviceSnapshot, ...platformSnapshot]),
      };
    };

    for (let index = 0; index < this.pendingMessages.length; index += 1) {
      this.pendingMessages[index] = refresh(this.pendingMessages[index]);
    }
    this.hooks.onMessagesChange((messages) => messages.map(refresh));
  }

  private connectToYouTube() {
    if (!this.activeConfig?.youtubeChannel) return;

    log.info(
      LOG_CATEGORIES.CHAT,
      `Connecting to YouTube channel: ${this.activeConfig.youtubeChannel}`,
    );

    this.youtubeService.connect(
      this.activeConfig.youtubeChannel,
      this.activeConfig.youtubeWebSocketUrl,
      {
        onMessage: async (message) => {
          if (!this.activeConfig) return;

          const preparedMessage = await this.prepareMessageForDisplay(message);
          if (preparedMessage) this.appendMessage(preparedMessage);
        },
        onDelete: (messageId) => {
          this.discardPendingMessages((message) => message.id === messageId);
          this.hooks.onMessagesChange((messages) =>
            messages.filter((message) => message.id !== messageId),
          );
          removeMessageElements(`[data-id="${messageId}"]`, this.pendingTimers);
        },
        onBan: (userId) => {
          this.discardPendingMessages((message) => message.userId === userId);
          this.hooks.onMessagesChange((messages) =>
            messages.filter((message) => message.userId !== userId),
          );
          removeMessageElements(`[data-user-id="${userId}"]`, this.pendingTimers);
        },
        onConnectionChange: (connected) => {
          log.info(
            LOG_CATEGORIES.CHAT,
            `YouTube chat ${connected ? "connected" : "disconnected"}`,
          );
          if (!this.channel.trim()) {
            this.connected = connected;
            this.hooks.onConnectionChange(connected);
            if (connected) this.setLoading("Готово!", 100);
          }
        },
      },
    );
  }

  private async loadRecentMessages(): Promise<number> {
    if (!this.activeConfig || !this.chatService) return 0;

    try {
      const rawMessages = await fetchRecentMessages(
        this.channel,
        RECENT_MESSAGE_LIMIT,
      );
      if (rawMessages.length === 0) return 0;

      const parsedMessages = rawMessages
        .map((line) => this.twitchService.parseMessageLine(line))
        .filter((message): message is TwitchMessage => Boolean(message));

      const preparedMessages = (
        await Promise.all(
          parsedMessages.map((message) => this.prepareMessageForDisplay(message)),
        )
      ).filter((message): message is TwitchMessage => Boolean(message));

      if (preparedMessages.length === 0) return 0;

      this.hooks.onMessagesChange((messages) => {
        const nextMessages = [...messages, ...preparedMessages];
        return nextMessages.length > 100
          ? nextMessages.slice(-100)
          : nextMessages;
      });

      return preparedMessages.length;
    } catch (error) {
      log.warn(LOG_CATEGORIES.CHAT, "Failed to load recent messages", error);
      return 0;
    }
  }

  private async prepareMessageForDisplay(
    message: TwitchMessage,
  ): Promise<TwitchMessage | null> {
    if (!this.activeConfig || !this.chatService) return null;
    if (this.isDuplicateMessage(message)) return null;

    if (!this.chatService.shouldDisplayMessage(message.username, message.message)) {
      return null;
    }

    const userId = message.userId || "0";
    message.badges = mergeBadgesBySetId(message.badges, []);

    if (message.customRewardId) {
      const reward = await this.resolveChannelPointReward(message.customRewardId);
      if (reward) {
        message.channelPointReward = reward;
        if (reward.prompt.toUpperCase().includes("FFZ:GE")) {
          message.isGigantifiedEmote = true;
        }
      }
    }

    mentionStyleService.registerMessageAuthor(message);

    message.tokenSnapshot = createMessageTokenSnapshot(message.message);
    const serviceSnapshot = this.createMessageEmoteSnapshot(message);
    message.emoteSnapshot = new Map([
      ...serviceSnapshot,
      ...(message.emoteSnapshot ?? new Map<string, any>()),
    ]);
    this.rememberMessage(message);

    if (message.platform !== "youtube") {
      this.loadGqlSenderAndRefresh(message, userId);
      this.loadUserBadgesAndRefresh(message, userId);
    }

    return message;
  }

  private loadGqlSenderAndRefresh(message: TwitchMessage, userId: string) {
    if (!this.activeChannelId || !userId || userId === "0" || !message.id) {
      return;
    }

    const channelId = this.activeChannelId;
    const messageId = message.id;

    void twitchGqlService
      .loadSender(channelId, userId)
      .then((gqlSender) => {
        if (
          !gqlSender ||
          !this.chatService ||
          !this.seenMessageIds.has(messageId)
        ) {
          return;
        }

        const identity = resolveSenderIdentity(
          message.displayName,
          message.color,
          gqlSender.displayName,
          gqlSender.chatColor,
        );
        const badges = mergeBadgesBySetId(
          message.badges,
          gqlSender.displayBadges,
        );
        const badgesChanged =
          badges.length !== message.badges.length ||
          badges.some((badge, index) => badge !== message.badges[index]);

        if (
          identity.displayName === message.displayName &&
          identity.color === message.color &&
          !badgesChanged
        ) {
          return;
        }

        message.displayName = identity.displayName;
        message.color = identity.color;
        message.badges = badges;
        mentionStyleService.registerMessageAuthor(message);
        this.queueMessageRefresh(messageId, {
          displayName: identity.displayName,
          color: identity.color,
          badges,
        });
      })
      .catch(() => {});
  }

  private loadUserBadgesAndRefresh(message: TwitchMessage, userId: string) {
    if (!message.id) return;

    const messageId = message.id;
    const username = message.username;

    void badgeService
      .loadUserBadges(username, userId)
      .then((badges) => {
        if (
          badges.length === 0 ||
          !this.chatService ||
          !this.seenMessageIds.has(messageId)
        ) {
          return;
        }

        this.queueMessageRefresh(messageId);
      })
      .catch(() => {});
  }

  private isDuplicateMessage(message: TwitchMessage): boolean {
    return Boolean(message.id && this.seenMessageIds.has(message.id));
  }

  private rememberMessage(message: TwitchMessage) {
    if (!message.id) return;

    this.seenMessageIds.add(message.id);
    if (this.seenMessageIds.size <= 300) return;

    const oldest = this.seenMessageIds.values().next().value as string | undefined;
    if (oldest) this.seenMessageIds.delete(oldest);
  }

  private createMessageEmoteSnapshot(message: TwitchMessage) {
    const snapshot = new Map<string, any>();

    if (!this.chatService) {
      return snapshot;
    }

    const tokenSnapshot =
      message.tokenSnapshot?.source === message.message
        ? message.tokenSnapshot
        : createMessageTokenSnapshot(message.message);
    for (const token of tokenSnapshot.tokens) {
      if (!token.raw || token.isWhitespace) continue;

      const emoteName = token.cleanText;
      if (!emoteName) continue;

      const emote = this.chatService.getEmote(emoteName, message.username);
      if (emote) {
        snapshot.set(emoteName, { ...emote });
      }
    }

    return snapshot;
  }

  private async resolveChannelPointReward(
    rewardId: string,
  ): Promise<TwitchGqlCustomReward | null> {
    if (!rewardId) return null;

    return new Promise<TwitchGqlCustomReward | null>((resolve) => {
      const timeout = window.setTimeout(() => resolve(null), 350);
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
