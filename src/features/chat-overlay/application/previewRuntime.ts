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
} from "~/config/chatAnimation";
import type { ChatConfig } from "~/config/chatUrlParams";
import type { ChatRuntimeHooks } from "./runtimeHooks";
import type { TwitchMessage } from "~/services/chat/twitch/twitchService";
import { selectPreviewModeration } from "../model/previewModeration";

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
  /**
   * Releases the process-wide stores this document's preview filled. The
   * preview runtime is the only runtime in its document, so its teardown leaves
   * that document's singletons empty instead of leaving the demo's emotes and
   * badges behind.
   */
  resetSharedAssetState: () => void;
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
  resetSharedAssetState: () => {
    mentionStyleService.reset();
    badgeService.reset();
    emoteService.reset();
  },
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
  private debugDisconnected = false;
  private connectionGeneration = 0;
  private nextModerationAt = 0;
  private moderationInProgress = false;
  private readonly mutedUntil = new Map<string, number>();
  /**
   * Set by `initialize()`, which is what claims the shared proxy flag and fills
   * the shared asset stores. Teardown releases them only for a runtime that
   * actually took them.
   */
  private holdsSharedState = false;

  constructor(
    private readonly options: PreviewRuntimeOptions,
    private readonly hooks: PreviewRuntimeHooks,
    private readonly dependencies = browserDependencies,
  ) {
    this.config = options.initialConfig;
  }

  async initialize() {
    // Destruction is terminal: a runtime that released the shared state it
    // claimed must not claim it again.
    if (this.destroyed) return;
    const { channel } = this.options;
    const isRealChannel = Boolean(channel && channel !== "chatyxpreview");

    this.dependencies.setProxyEnabled(this.config.rteProxy);
    this.holdsSharedState = true;
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
    this.hooks.onConnectionChange(!this.debugDisconnected);

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
    if (this.destroyed) return;
    const speedChanged = this.config.messageSpeed !== config.messageSpeed;
    this.config = config;
    this.dependencies.setProxyEnabled(config.rteProxy);
    this.holdsSharedState = true;
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

  debugDisconnect() {
    if (this.destroyed || this.debugDisconnected) return;
    this.debugDisconnected = true;
    this.connectionGeneration += 1;
    this.clearMessageInterval();
    this.service?.cancelMessageRemovals();
    this.moderationInProgress = false;
    this.hooks.onConnectionChange(false);
  }

  debugReconnect() {
    if (this.destroyed || !this.debugDisconnected) return;
    this.debugDisconnected = false;
    this.nextModerationAt = Date.now() + 9000;
    this.restartMessageInterval();
    this.hooks.onConnectionChange(true);
  }

  destroy() {
    this.destroyed = true;
    this.connectionGeneration += 1;
    this.ready = false;
    this.clearMessageInterval();
    this.mutedUntil.clear();
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    cleanupPreviewStyles();
    this.service?.cleanup();
    this.service = null;

    // Release the document-wide state this runtime claimed. Concurrency is not
    // possible by design: a document hosts exactly one chat runtime, so the
    // runtime that enabled the proxy flag and filled the asset stores is the
    // one that clears them.
    if (this.holdsSharedState) {
      this.holdsSharedState = false;
      this.dependencies.setProxyEnabled(false);
      this.dependencies.resetSharedAssetState();
    }
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
    this.nextModerationAt = Date.now() + 9000;
    this.restartMessageInterval();
  }

  private appendMessage() {
    if (!this.service || this.destroyed || this.debugDisconnected) return;

    const message = nextPreviewMessage(
      this.options.channel,
      this.service,
      this.channelId,
      this.options.demoKind,
      this.config.showGifs,
    );
    const now = Date.now();
    for (const [username, until] of this.mutedUntil) {
      if (until <= now) this.mutedUntil.delete(username);
    }
    if (this.mutedUntil.has(message.username.toLowerCase())) {
      this.maybeModerate(now);
      return;
    }
    mentionStyleService.registerMessageAuthor(message);
    this.hooks.onMessagesChange((current) => {
      const messages = [...current, message];
      return messages.length > 30 ? messages.slice(-30) : messages;
    });
    this.service.scrollToLatest(
      getAnimationScrollBehavior(this.config.animation),
    );
    this.maybeModerate(now);
  }

  private maybeModerate(now: number) {
    if (this.destroyed || this.debugDisconnected || !this.ready || !this.service || this.moderationInProgress || now < this.nextModerationAt) return;
    if (messageSpeedToIntervalMs(this.config.messageSpeed) === null) return;
    const rows = Array.from(document.querySelectorAll<HTMLElement>("#chat_container .chat_line[data-id]"));
    const visibleIds = new Set(rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    }).map((row) => row.dataset.id ?? ""));
    let messages: TwitchMessage[] = [];
    this.hooks.onMessagesChange((current) => {
      messages = current;
      return current;
    });
    const selection = selectPreviewModeration(messages, visibleIds);
    this.nextModerationAt = now + 8000 + Math.random() * 4000;
    if (!selection) return;
    if (selection.mutedUsername) this.mutedUntil.set(selection.mutedUsername, now + 30000);
    const targets = rows.filter((row) => selection.ids.has(row.dataset.id ?? ""));
    const container = document.getElementById("chat_container");
    this.moderationInProgress = true;
    const generation = this.connectionGeneration;
    const remove = () => {
      if (this.destroyed || this.debugDisconnected || generation !== this.connectionGeneration) return;
      this.moderationInProgress = false;
      this.hooks.onMessagesChange((current) => current.filter((message) => !selection.ids.has(message.id)));
    };
    if (container && targets.length > 1) this.service.removeMessageGroup(container, targets, this.config.removalAnimation, remove);
    else if (targets.length === 1) this.service.removeMessage(targets[0], this.config.removalAnimation, remove);
    else remove();
  }

  private restartMessageInterval() {
    this.clearMessageInterval();
    if (!this.ready || this.debugDisconnected || this.destroyed) return;

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
