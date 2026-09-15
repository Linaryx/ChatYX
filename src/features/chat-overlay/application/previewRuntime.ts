import {
  ChatPresentationService,
  createChatPresentationConfig,
} from "~/services/chat/chatPresentationService";
import { emoteService } from "~/services/chat/assets/emoteService";
import { mentionStyleService } from "~/services/chat/mentionStyleService";
import {
  cleanupPreviewStyles,
  createPreviewMessages,
  fetchChannelUsers,
  injectPreviewStyles,
  nextPreviewMessage,
  resolveChannelId,
  type PreviewDemoKind,
} from "~/services/chat/preview";
import { sevenTVCosmeticsService } from "~/services/chat/seven-tv/cosmeticsService";
import { setRteProxyEnabled } from "~/services/network/networkClient";
import { badgeService } from "~/services/badges";
import {
  getAnimationScrollBehavior,
  hasMessageEntryAnimation,
  messageSpeedToIntervalMs,
} from "~/utils/ui/animationUtils";
import type { ChatConfig } from "~/utils/chat";
import type { ChatRuntimeHooks } from "./runtimeHooks";

const CHANNEL_RESOLUTION_TIMEOUT_MS = 8_000;
const EMOTE_LOADING_TIMEOUT_MS = 12_000;
const ASSET_LOADING_TIMEOUT_MS = 10_000;
const INITIAL_RENDER_DELAY_MS = 700;

export type PreviewRuntimeOptions = {
  channel: string;
  initialConfig: ChatConfig;
  demoKind: PreviewDemoKind;
};

export type PreviewRuntimeHooks = Omit<
  ChatRuntimeHooks,
  "onCommandStatusChange"
> & {
  onLoadingComplete: () => void;
};

export type PreviewRuntimeDependencies = {
  createPresentationService: (config: ChatConfig) => ChatPresentationService;
  setProxyEnabled: (enabled: boolean) => void;
  resolveChannelId: (channel: string) => Promise<string>;
  fetchChannelUsers: (channel: string, channelId: string) => Promise<unknown>;
  loadEmotes: (
    channelId: string,
    channel: string,
    show7tvUnlisted: boolean,
  ) => Promise<unknown>;
  loadBadges: (channel: string, channelId: string) => Promise<unknown>;
  loadCosmetics: (channelId: string) => Promise<unknown>;
};

const browserDependencies: PreviewRuntimeDependencies = {
  createPresentationService: (config) =>
    new ChatPresentationService(createChatPresentationConfig(config)),
  setProxyEnabled: setRteProxyEnabled,
  resolveChannelId,
  fetchChannelUsers,
  loadEmotes: (channelId, channel, show7tvUnlisted) =>
    emoteService.loadEmotes(channelId, channel, { show7tvUnlisted }),
  loadBadges: (channel, channelId) => badgeService.loadBadges(channel, channelId),
  loadCosmetics: (channelId) => sevenTVCosmeticsService.loadCosmetics(channelId),
};

function isTwitchUserId(value: string): boolean {
  return /^\d+$/.test(value) && value !== "0";
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then(resolve)
      .catch(() => resolve(fallback))
      .finally(() => window.clearTimeout(timeout));
  });
}

export class PreviewRuntime {
  private config: ChatConfig;
  private service: ChatPresentationService | null = null;
  private channelId = "0";
  private messageInterval: number | null = null;
  private renderTimer: number | null = null;
  private ready = false;
  private destroyed = false;

  constructor(
    private readonly options: PreviewRuntimeOptions,
    private readonly hooks: PreviewRuntimeHooks,
    private readonly dependencies = browserDependencies,
  ) {
    this.config = options.initialConfig;
  }

  async initialize() {
    this.destroyed = false;
    const { channel } = this.options;
    const isRealChannel = Boolean(channel && channel !== "chatyxpreview");

    this.dependencies.setProxyEnabled(this.config.rteProxy);
    this.service = this.dependencies.createPresentationService(this.config);
    mentionStyleService.reset();
    this.service.updateConfig({ userId: "0" });

    this.hooks.onConfigResolved(this.config);
    this.hooks.onServiceReady(this.service);
    this.hooks.onAnimationDurationChange(
      hasMessageEntryAnimation(this.config.animation)
        ? this.service.getConfig().animation.duration
        : 0,
    );
    this.hooks.onChannelResolved({ channelId: "0", displayName: channel });
    this.hooks.onConnectionChange(true);

    const container = document.getElementById("chat_container");
    if (container) this.service.initializeLayout(container);
    injectPreviewStyles(this.config);

    try {
      this.setLoading("Подготавливаем предпросмотр...", 25);
      this.channelId = isRealChannel
        ? await withTimeout(
            this.dependencies.resolveChannelId(channel),
            CHANNEL_RESOLUTION_TIMEOUT_MS,
            "0",
          )
        : "0";
      if (this.destroyed) return;

      this.service.updateConfig({ userId: this.channelId });
      this.setLoading("Загружаем данные предпросмотра...", 55);
      const hasChannelId = isTwitchUserId(this.channelId);
      const assetLoading = Promise.allSettled([
        withTimeout(
          this.dependencies.loadEmotes(
            this.channelId,
            channel,
            this.config.show7tvUnlisted,
          ),
          EMOTE_LOADING_TIMEOUT_MS,
          undefined,
        ),
        ...(isRealChannel && hasChannelId
          ? [
              withTimeout(
                this.dependencies.loadBadges(channel, this.channelId),
                ASSET_LOADING_TIMEOUT_MS,
                undefined,
              ),
              withTimeout(
                this.dependencies.loadCosmetics(this.channelId),
                ASSET_LOADING_TIMEOUT_MS,
                undefined,
              ),
            ]
          : []),
      ]);

      if (isRealChannel) {
        await withTimeout(
          this.dependencies.fetchChannelUsers(channel, this.channelId),
          ASSET_LOADING_TIMEOUT_MS,
          undefined,
        );
      }
      await assetLoading;
      if (this.destroyed) return;

      this.setLoading("Отрисовываем предпросмотр...", 85);
      this.renderTimer = window.setTimeout(
        () => this.finishInitialization(),
        INITIAL_RENDER_DELAY_MS,
      );
    } catch (error) {
      if (this.destroyed) return;
      console.error("[Preview] Initialization failed:", error);
      this.setLoading("Не удалось загрузить предпросмотр", 100);
      this.hooks.onLoadingComplete();
    }
  }

  updateConfig(config: ChatConfig) {
    const speedChanged = this.config.messageSpeed !== config.messageSpeed;
    this.config = config;
    this.dependencies.setProxyEnabled(config.rteProxy);
    this.hooks.onConfigResolved(config);
    injectPreviewStyles(config);

    if (this.service) {
      const presentationConfig = createChatPresentationConfig(config);
      presentationConfig.userId = this.channelId;
      this.service.updateConfig(presentationConfig);
      this.hooks.onAnimationDurationChange(
        hasMessageEntryAnimation(config.animation)
          ? presentationConfig.animation.duration
          : 0,
      );
      this.service.scrollToLatest(
        getAnimationScrollBehavior(config.animation),
      );
    }

    if (speedChanged) this.restartMessageInterval();
  }

  destroy() {
    this.destroyed = true;
    this.ready = false;
    this.clearMessageInterval();
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    cleanupPreviewStyles();
    this.service?.cleanup();
    this.service = null;
  }

  private finishInitialization() {
    this.renderTimer = null;
    if (this.destroyed || !this.service) return;

    const messages = createPreviewMessages(
      this.options.channel,
      this.service,
      this.channelId,
      this.options.demoKind,
      6,
      this.config.showGifs,
    );
    messages.forEach((message) => mentionStyleService.registerMessageAuthor(message));
    this.hooks.onMessagesChange(() => messages);
    this.service.scrollToLatest(
      getAnimationScrollBehavior(this.config.animation),
    );
    this.setLoading("Предпросмотр готов", 100);
    this.ready = true;
    this.restartMessageInterval();
  }

  private appendMessage() {
    if (!this.service || this.destroyed) return;

    const message = nextPreviewMessage(
      this.options.channel,
      this.service,
      this.channelId,
      this.options.demoKind,
      this.config.showGifs,
    );
    mentionStyleService.registerMessageAuthor(message);
    this.hooks.onMessagesChange((current) => {
      const messages = [...current, message];
      return messages.length > 30 ? messages.slice(-30) : messages;
    });
    this.service.scrollToLatest(
      getAnimationScrollBehavior(this.config.animation),
    );
  }

  private restartMessageInterval() {
    this.clearMessageInterval();
    if (!this.ready) return;

    const interval = messageSpeedToIntervalMs(this.config.messageSpeed);
    if (interval !== null) {
      this.messageInterval = window.setInterval(() => this.appendMessage(), interval);
    }
  }

  private clearMessageInterval() {
    if (this.messageInterval === null) return;
    window.clearInterval(this.messageInterval);
    this.messageInterval = null;
  }

  private setLoading(status: string, progress: number) {
    this.hooks.onLoadingChange({ status, progress });
  }
}
