import {
  DEFAULT_RECENT_MESSAGE_LIMIT,
  parseChatConfigFromSearchParams,
  parseRecentMessageLimit,
} from "~/config/chatUrlParams";
import {
  ChatPresentationService,
  createChatPresentationConfig,
  emoteService,
  mentionStyleService,
  chatFeatureIntegration,
  setRteProxyEnabled,
  type TwitchMessage,
} from "~/services/chat";
import { fetchRecentMessages } from "~/services/chat/recentMessagesService";
import {
  getAnimationScrollBehavior,
  hasMessageEntryAnimation,
} from "~/utils/ui/animationUtils";
import { log, LOG_CATEGORIES } from "~/utils/logger";
import type { ChatConfig } from "~/utils/chat";
import {
  ChatCommandFeedback,
  CHATYX_DEVELOPER_CHANNEL,
  getAuthorizedChatCommand,
  isDeveloperChatMessage,
  parseChatRefreshScope,
  parseTestMessageCount,
} from "./chatCommandService";
import { createBrowserRteRuntime } from "./browserRteTts";
import type { RteRuntime } from "./rteRuntimeController";
import {
  AnnouncementColorResolver,
  ChatAssetLoader,
  ChatConnectionManager,
  ChannelIdentityResolver,
  MessagePreparationPipeline,
  MessageQueueManager,
  OverlayStyleManager,
  type ChannelIdentity,
  type MessageUpdater,
} from "./runtime";

type LoadingState = {
  status: string;
  progress: number;
};

export type ChatCommandStatus = {
  text: string;
};

type OverlayRuntimeHooks = {
  onConfigResolved: (config: ChatConfig) => void;
  onServiceReady: (service: ChatPresentationService) => void;
  onLoadingChange: (state: LoadingState) => void;
  onCommandStatusChange: (status: ChatCommandStatus | null) => void;
  onConnectionChange: (connected: boolean) => void;
  onMessagesChange: (updater: MessageUpdater) => void;
  onAnimationDurationChange: (durationMs: number) => void;
  onChannelResolved: (resolution: ChannelIdentity) => void;
};

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

export class OverlayRuntime {
  private readonly commandFeedback = new ChatCommandFeedback();
  private readonly styleManager = new OverlayStyleManager();
  private readonly announcementColorResolver: AnnouncementColorResolver;
  private readonly assetLoader: ChatAssetLoader;
  private readonly connectionManager: ChatConnectionManager;
  private readonly channelIdentityResolver: ChannelIdentityResolver;
  private readonly messagePipeline: MessagePreparationPipeline;
  private readonly messageQueue: MessageQueueManager;
  private readonly rteRuntime: RteRuntime;

  private chatService: ChatPresentationService | null = null;
  private readonly pendingTimers: number[] = [];
  private initialized = false;
  private activeChannelId = "";
  private activeConfig: ChatConfig | null = null;
  private recentMessageLimit = DEFAULT_RECENT_MESSAGE_LIMIT;
  private commandStatusTimer: number | null = null;
  private refreshInProgress = false;
  private reloadInProgress = false;
  private initializationGeneration = 0;
  private readonly eventHandlers = {
    messageDeleted: (event: Event) => {
      const customEvent = event as CustomEvent<{ messageId: string }>;
      const { messageId } = customEvent.detail;
      this.rteRuntime.cancelMessage(messageId);
      this.messagePipeline.cancelMessage(messageId);
      this.messageQueue.discard((message) => message.id === messageId);
      this.hooks.onMessagesChange((messages) =>
        messages.filter((message) => message.id !== messageId),
      );
    },
    userTimeout: (event: Event) => {
      const customEvent = event as CustomEvent<{ username: string }>;
      const username = customEvent.detail.username.toLowerCase();
      this.rteRuntime.cancelUser({ username });
      this.messagePipeline.cancelUser(username);
      this.messageQueue.discard(
        (message) => message.username.toLowerCase() === username,
      );
      this.hooks.onMessagesChange((messages) =>
        messages.filter((message) => message.username.toLowerCase() !== username),
      );
    },
    userBanned: (event: Event) => {
      const customEvent = event as CustomEvent<{ username: string }>;
      const username = customEvent.detail.username.toLowerCase();
      this.rteRuntime.cancelUser({ username });
      this.messagePipeline.cancelUser(username);
      this.messageQueue.discard(
        (message) => message.username.toLowerCase() === username,
      );
      this.hooks.onMessagesChange((messages) =>
        messages.filter((message) => message.username.toLowerCase() !== username),
      );
    },
    chatCleared: () => {
      log.debug(LOG_CATEGORIES.INTEGRATION, "Clearing all chat messages");
      this.rteRuntime.cancelAll();
      this.messagePipeline.cancelPending();
      this.messageQueue.clear();
      this.messageQueue.clearRefreshes();
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
    rteRuntime: RteRuntime = createBrowserRteRuntime(),
  ) {
    this.rteRuntime = rteRuntime;
    this.announcementColorResolver = new AnnouncementColorResolver(channel);
    this.assetLoader = new ChatAssetLoader(channel);
    this.channelIdentityResolver = new ChannelIdentityResolver(channel);
    this.messageQueue = new MessageQueueManager({
      getConfig: () => this.activeConfig,
      getService: () => this.chatService,
      onAnimationDurationChange: hooks.onAnimationDurationChange,
      onMessagesChange: hooks.onMessagesChange,
    });
    this.messagePipeline = new MessagePreparationPipeline({
      announcementColorResolver: this.announcementColorResolver,
      assetLoader: this.assetLoader,
      getConfig: () => this.activeConfig,
      getService: () => this.chatService,
      onMessageRefresh: (messageId, patch) =>
        this.messageQueue.queueRefresh(messageId, patch),
    });
    this.connectionManager = new ChatConnectionManager({
      onChatClear: () => this.clearMessages(),
      onMessageDelete: (messageId) => this.deleteMessage(messageId),
      onTwitchConnectionChange: (connected) => {
        this.hooks.onConnectionChange(connected);
        if (connected) this.setLoading("Готово!", 100);
      },
      onTwitchMessage: async (message) => {
        if (!this.activeConfig) return;
        this.handleChatCommand(message);
        if (isDeveloperChatMessage(message, this.channel)) return;
        const preparedMessage = await this.prepareMessageForDisplay(message);
        if (preparedMessage) this.appendMessage(preparedMessage);
      },
      onTwitchUserClear: (username) => this.clearUserMessages(username),
      onYouTubeConnectionChange: (connected) => {
        if (this.channel.trim()) return;
        this.hooks.onConnectionChange(connected);
        if (connected) this.setLoading("Готово!", 100);
      },
      onYouTubeMessage: async (message) => {
        if (!this.activeConfig) return;
        const preparedMessage = await this.prepareMessageForDisplay(message);
        if (preparedMessage) this.appendMessage(preparedMessage);
      },
      onYouTubeUserBan: (userId) => this.banYouTubeUser(userId),
    });
  }

  getService() {
    return this.chatService;
  }

  updateConfig(config: ChatConfig) {
    this.activeConfig = config;
    setRteProxyEnabled(config.rteProxy);
    this.rteRuntime.updateConfig(config);
    this.hooks.onConfigResolved(config);
    this.styleManager.apply(config);

    if (this.chatService) {
      const presentationConfig = createChatPresentationConfig(config);
      presentationConfig.userId = this.activeChannelId;
      this.chatService.updateConfig(presentationConfig);
      this.hooks.onAnimationDurationChange(
        hasMessageEntryAnimation(config.animation)
          ? presentationConfig.animation.duration
          : 0,
      );
      this.chatService.scrollToLatest(
        getAnimationScrollBehavior(config.animation),
      );
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized || typeof window === "undefined") return;
    const initializationGeneration = ++this.initializationGeneration;

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
    this.recentMessageLimit = parseRecentMessageLimit(urlParams);
    const hasTwitchChannel = Boolean(this.channel.trim());

    this.activeConfig = chatConfig;
    setRteProxyEnabled(chatConfig.rteProxy);
    this.rteRuntime.updateConfig(chatConfig);
    this.hooks.onConfigResolved(chatConfig);
    this.setLoading("Подготовка стилей...", 25);
    this.styleManager.apply(chatConfig);

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
      ? await this.channelIdentityResolver.resolve()
      : { channelId: "", displayName: "" };
    if (!this.isInitializationCurrent(initializationGeneration)) return;
    this.hooks.onChannelResolved(channelResolution);

    const channelId = channelResolution.channelId;
    this.activeChannelId = channelId;
    log.info(
      LOG_CATEGORIES.CHAT,
      `Using identifier: ${channelId || this.channel} (${channelId ? "ID" : "name"})`,
    );

    this.setLoading("Загрузка баджей и эмоутов...", 55);
    await service.initialize(this.channel, channelId);
    if (!this.isInitializationCurrent(initializationGeneration)) return;

    if (channelId) {
      this.setLoading("Подключение 7TV EventAPI...", 70);
      await chatFeatureIntegration.initialize(channelId).catch((error) => {
        log.error(LOG_CATEGORIES.INTEGRATION, "Failed to initialize chat feature integration", error);
      });
      if (!this.isInitializationCurrent(initializationGeneration)) return;
    }

    this.initializeLayout(service);

    if (hasTwitchChannel) {
      this.announcementColorResolver.preload();
      this.assetLoader.preloadChannelRewards();
    }

    this.setLoading("Загрузка эмоутов...", 76);
    void this.assetLoader
      .loadEmotes({
        channelId,
        show7tvUnlisted: chatConfig.show7tvUnlisted,
      })
      .then(() => {
        if (this.isInitializationCurrent(initializationGeneration)) {
          this.refreshRenderedMessages();
        }
      });

    this.setLoading(
      chatConfig.recentMessages && hasTwitchChannel
        ? "Загрузка последних сообщений..."
        : "Пропуск последних сообщений...",
      82,
    );
    const loadedRecentMessages = chatConfig.recentMessages && hasTwitchChannel
      ? await this.loadRecentMessages()
      : 0;
    if (!this.isInitializationCurrent(initializationGeneration)) return;

    this.setLoading("Фоновая загрузка данных...", 85);
    void this.assetLoader.loadDeferredAssets(channelId, hasTwitchChannel);

    this.setupEventListeners();

    this.setLoading(
      hasTwitchChannel ? "Подключение к Twitch IRC..." : "Подключение к YouTube...",
      95,
    );
    if (loadedRecentMessages > 0) {
      this.setLoading("Подключение к Twitch IRC...", 100);
    }
    if (hasTwitchChannel) {
      this.connectionManager.connectTwitch(this.channel, [
        CHATYX_DEVELOPER_CHANNEL,
      ]);
    }
    this.connectionManager.connectYouTube(
      chatConfig.youtubeChannel,
      chatConfig.youtubeWebSocketUrl,
    );
    this.initialized = true;
    log.info(LOG_CATEGORIES.CHAT, "Chat overlay initialized");
  }

  destroy(preserveRteRuntime = false) {
    this.initializationGeneration += 1;
    for (const id of this.pendingTimers) window.clearTimeout(id);
    this.pendingTimers.length = 0;
    this.messageQueue.destroy();
    this.messagePipeline.clear();
    this.removeEventListeners();
    this.connectionManager.destroy();
    this.commandFeedback.destroy();
    if (preserveRteRuntime) this.rteRuntime.cancelAll();
    else this.rteRuntime.destroy();
    this.setCommandStatus(null);
    chatFeatureIntegration.destroy();
    this.chatService?.cleanup();
    this.chatService = null;
    this.initialized = false;
  }

  private setLoading(status: string, progress: number) {
    this.hooks.onLoadingChange({ status, progress });
  }

  private isInitializationCurrent(generation: number) {
    return generation === this.initializationGeneration;
  }

  private setCommandStatus(
    status: ChatCommandStatus | null,
    durationMs?: number,
  ) {
    if (this.commandStatusTimer !== null) {
      window.clearTimeout(this.commandStatusTimer);
      this.commandStatusTimer = null;
    }
    this.hooks.onCommandStatusChange(status);
    if (status && durationMs) {
      this.commandStatusTimer = window.setTimeout(
        () => this.setCommandStatus(null),
        durationMs,
      );
    }
  }

  private initializeLayout(service: ChatPresentationService) {
    const container = document.getElementById("chat_container");
    if (!container) return;

    service.initializeLayout(container);
  }

  private appendMessage(message: TwitchMessage) {
    if (!this.chatService || !this.activeConfig) return;
    this.rteRuntime.handleDisplayedMessage(message);
    this.messageQueue.append(message);
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

  private deleteMessage(messageId: string) {
    log.debug(LOG_CATEGORIES.CHAT, `Deleting message: ${messageId}`);
    this.rteRuntime.cancelMessage(messageId);
    this.messagePipeline.cancelMessage(messageId);
    this.messageQueue.discard((message) => message.id === messageId);
    this.hooks.onMessagesChange((messages) =>
      messages.filter((message) => message.id !== messageId),
    );
    removeMessageElements(`[data-id="${messageId}"]`, this.pendingTimers);
  }

  private clearUserMessages(username: string) {
    log.debug(LOG_CATEGORIES.CHAT, `Clearing chat for user: ${username}`);
    const normalizedUsername = username.toLowerCase();
    this.rteRuntime.cancelUser({ username: normalizedUsername });
    this.messagePipeline.cancelUser(normalizedUsername);
    this.messageQueue.discard(
      (message) => message.username.toLowerCase() === normalizedUsername,
    );
    this.hooks.onMessagesChange((messages) =>
      messages.filter(
        (message) => message.username.toLowerCase() !== normalizedUsername,
      ),
    );
    removeMessageElements(`[data-nick="${username}"]`, this.pendingTimers);
  }

  private banYouTubeUser(userId: string) {
    this.rteRuntime.cancelUser({ userId });
    this.messagePipeline.cancelUserId(userId);
    this.messageQueue.discard((message) => message.userId === userId);
    this.hooks.onMessagesChange((messages) =>
      messages.filter((message) => message.userId !== userId),
    );
    removeMessageElements(`[data-user-id="${userId}"]`, this.pendingTimers);
  }

  private clearMessages() {
    log.debug(LOG_CATEGORIES.CHAT, "Clearing all chat messages");
    this.rteRuntime.cancelAll();
    this.messagePipeline.cancelPending();
    this.messageQueue.clear();
    this.messageQueue.clearRefreshes();
    this.hooks.onMessagesChange(() => []);
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
        if (this.refreshInProgress || this.reloadInProgress) {
          this.setCommandStatus({ text: "Операция уже выполняется" }, 2500);
          break;
        }

        const refreshScope = parseChatRefreshScope(command.args);
        if (!refreshScope) {
          this.setCommandStatus(
            { text: "Используй: refresh [all|emotes|badges|cosmetics]" },
            4000,
          );
          break;
        }

        this.refreshInProgress = true;
        this.setCommandStatus({
          text: `Обновляем ${refreshScope === "all" ? "ассеты" : refreshScope}...`,
        });
        const visibleMessages = this.messageQueue.captureVisibleMessages();
        const cosmeticUsers = [
          ...visibleMessages,
          ...this.messageQueue.getPendingMessages(),
        ]
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

        void this.assetLoader
          .refresh(
            {
              channelId: this.activeChannelId,
              show7tvUnlisted: this.activeConfig.show7tvUnlisted,
            },
            cosmeticUsers,
            refreshScope,
          )
          .then(() => {
            if (refreshScope === "all" || refreshScope === "cosmetics") {
              this.chatService?.clearPaintCache();
            }
            this.refreshRenderedMessages();
            this.setCommandStatus(null);
          })
          .catch((error) => {
            log.error(LOG_CATEGORIES.CHAT, "Failed to refresh chat assets", error);
            this.setCommandStatus(
              { text: "Не удалось обновить данные" },
              3500,
            );
          })
          .finally(() => {
            this.refreshInProgress = false;
          });
        break;
      }
      case "reload":
        void this.softReload();
        break;
      case "hardreload":
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
        this.rteRuntime.cancelAll();
        this.messagePipeline.cancelPending();
        this.messageQueue.clear();
        this.messageQueue.clearRefreshes();
        this.hooks.onMessagesChange(() => []);
        break;
      case "ping":
        this.commandFeedback.showNotice("Pong! ChatYX работает");
        break;
      case "test":
        this.appendTestMessages(message, parseTestMessageCount(command.args));
        break;
      case "tts":
        this.rteRuntime.handleAuthorizedCommand(command.args, message);
        break;
    }
  }

  private async softReload(): Promise<void> {
    if (this.reloadInProgress || this.refreshInProgress) {
      this.setCommandStatus({ text: "Операция уже выполняется" }, 2500);
      return;
    }

    this.reloadInProgress = true;
    this.destroy(true);
    this.setCommandStatus({ text: "Перезапускаем чат без перезагрузки страницы..." });

    try {
      await this.initialize();
      this.setCommandStatus(null);
    } catch (error) {
      log.error(LOG_CATEGORIES.CHAT, "Failed to soft reload chat", error);
      this.setCommandStatus({ text: "Не удалось перезапустить чат" }, 4000);
    } finally {
      this.reloadInProgress = false;
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

  private refreshRenderedMessages(): void {
    this.messageQueue.refreshMessages((message) =>
      this.messagePipeline.refresh(message),
    );
    this.scrollToLatestAfterRender();
  }

  private scrollToLatestAfterRender(): void {
    window.requestAnimationFrame(() => {
      if (!this.chatService || !this.activeConfig) return;
      this.chatService.scrollToLatest(
        getAnimationScrollBehavior(this.activeConfig.animation),
      );
    });
  }

  private async loadRecentMessages(): Promise<number> {
    if (!this.activeConfig || !this.chatService) return 0;

    try {
      const rawMessages = await fetchRecentMessages(
        this.channel,
        this.recentMessageLimit,
      );
      if (rawMessages.length === 0) return 0;

      const parsedMessages = rawMessages
        .map((line) => this.connectionManager.parseTwitchMessageLine(line))
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
      this.scrollToLatestAfterRender();

      return preparedMessages.length;
    } catch (error) {
      log.warn(LOG_CATEGORIES.CHAT, "Failed to load recent messages", error);
      return 0;
    }
  }

  private async prepareMessageForDisplay(
    message: TwitchMessage,
  ): Promise<TwitchMessage | null> {
    return this.messagePipeline.prepare(message);
  }

}
