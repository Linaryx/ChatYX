import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { PerfMonitor } from "~/components/debug/PerfMonitor";
import { Title } from "@solidjs/meta";
import { LoadingScreen } from "~/components/LoadingScreen";
import { ChatMessageList } from "~/components/chat/ChatMessageList";
import {
  createPreviewPredictionEvent,
  PredictionProgressOverlay,
} from "~/components/predictions/PredictionProgressOverlay";
import { parseChatConfigFromSearchParams } from "~/config/chatUrlParams";
import {
  createChatPresentationConfig,
  OverlayRuntime,
  ChatPresentationService,
  type ChatCommandStatus,
  emoteService,
  mentionStyleService,
  sevenTVCosmeticsService,
  type TwitchMessage,
} from "~/services/chat";
import { setRteProxyEnabled } from "~/services/network/networkClient";
import { badgeService } from "~/services/badges";
import {
  createTwitchPredictionsClient,
  type TwitchPredictionEvent,
} from "~/services/predictions/twitchPredictions";
import "~/styles/chat.css";
import type { ChatConfig } from "~/utils/chat";
import {
  fetchChannelUsers,
  resolveChannelId,
  nextPreviewMessage,
  createPreviewMessages,
  injectPreviewStyles,
  cleanupPreviewStyles,
  isChatPreviewConfigMessage,
  type PreviewDemoKind,
} from "~/services/chat/preview";
import {
  DEFAULT_ANIMATION_OPTIONS,
  getAnimationScrollBehavior,
  hasMessageEntryAnimation,
  messageSpeedToIntervalMs,
} from "~/utils/ui/animationUtils";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgb(hex: string): string {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "0, 0, 0";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
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

function isTwitchUserId(value: string): boolean {
  return /^\d+$/.test(value) && value !== "0";
}

function parsePreviewDemoKind(raw: string | null): PreviewDemoKind {
  return raw === "emote" ? "emote" : "pasta";
}

export default function ChatOverlay() {
  const urlParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const isPreview = urlParams.get("preview") === "true";
  const isDebug = urlParams.get("debug") === "true";
  const initialConfig = parseChatConfigFromSearchParams(urlParams);
  const channel = initialConfig.channel || (isPreview ? "chatyxpreview" : "");
  const hasChannel = Boolean(channel || initialConfig.youtubeChannel);

  const [channelDisplayName, setChannelDisplayName] = createSignal("");
  const [config, setConfig] = createSignal<ChatConfig | null>(null);
  const [messages, setMessages] = createSignal<TwitchMessage[]>([]);
  const [isConnected, setIsConnected] = createSignal(false);
  const [chatService, setChatService] = createSignal<ChatPresentationService | null>(null);
  const [animationDurationMs, setAnimationDurationMs] = createSignal(
    DEFAULT_ANIMATION_OPTIONS.duration,
  );
  const [loadingProgress, setLoadingProgress] = createSignal(0);
  const [loadingStatus, setLoadingStatus] = createSignal("Initializing...");
  const [isLoading, setIsLoading] = createSignal(true);
  const [commandStatus, setCommandStatus] = createSignal<ChatCommandStatus | null>(null);
  const [prediction, setPrediction] = createSignal<TwitchPredictionEvent | null>(
    null,
  );
  const [predictionNow, setPredictionNow] = createSignal(Date.now());
  let previewService: ChatPresentationService | null = null;
  let previewInterval: number | undefined;
  let previewChannelId = "0";
  let previewReady = false;
  let previewDestroyed = false;
  let activePreviewConfig = initialConfig;
  let activePredictionsChannel = "";
  let predictionsClient: ReturnType<typeof createTwitchPredictionsClient> | null =
    null;
  let predictionClock: number | undefined;
  const previewDemoKind = parsePreviewDemoKind(urlParams.get("demo"));

  const runtime =
    hasChannel && !isPreview
      ? new OverlayRuntime(channel, {
          onConfigResolved: setConfig,
          onServiceReady: setChatService,
           onLoadingChange: ({ status, progress }) => {
             setLoadingStatus(status);
             setLoadingProgress(progress);
           },
           onCommandStatusChange: setCommandStatus,
          onConnectionChange: setIsConnected,
          onMessagesChange: (updater) => setMessages(updater),
          onAnimationDurationChange: setAnimationDurationMs,
          onChannelResolved: ({ displayName }) => setChannelDisplayName(displayName),
        })
      : null;

  const pageTitle = createMemo(() => {
    if (!hasChannel) return "ChatYX";
    if (isPreview) return "ChatYX • Preview";
    return `ChatYX • ${channelDisplayName() || channel || initialConfig.youtubeChannel}`;
  });
  const chatVisible = createMemo(() => !isLoading() || loadingProgress() >= 100);
  const hasMessages = createMemo(() => messages().length > 0);
  const showPredictionsBar = createMemo(
    () => Boolean((config() ?? initialConfig).showPredictions) && Boolean(channel),
  );
  const hasPredictionBar = createMemo(
    () => showPredictionsBar() && Boolean(prediction()),
  );
  const removeMessageById = (messageId: string) => {
    setMessages((current) =>
      current.filter((message) => message.id !== messageId),
    );
  };

  const stopPredictionsClient = () => {
    predictionsClient?.stop();
    predictionsClient = null;
    activePredictionsChannel = "";
  };

  const clearPredictionClock = () => {
    if (predictionClock === undefined) return;
    window.clearInterval(predictionClock);
    predictionClock = undefined;
  };

  createEffect(() => {
    const cfg = config();
    if (!cfg) return;

    const channelLogin = cfg.channel.trim().toLowerCase();
    const enabled = Boolean(cfg.showPredictions && channelLogin);

    if (!enabled) {
      stopPredictionsClient();
      setPrediction(null);
      clearPredictionClock();
      return;
    }

    if (predictionClock === undefined) {
      predictionClock = window.setInterval(
        () => setPredictionNow(Date.now()),
        1000,
      );
    }

    if (isPreview) {
      stopPredictionsClient();
      setPrediction(createPreviewPredictionEvent());
      return;
    }

    if (predictionsClient && activePredictionsChannel === channelLogin) {
      return;
    }

    stopPredictionsClient();
    const client = createTwitchPredictionsClient({
      channelLogin,
      onPrediction: setPrediction,
      onError: (error) => {
        console.warn("[Predictions]", error.message);
      },
    });
    predictionsClient = client;
    activePredictionsChannel = channelLogin;
    client.start();
  });

  const clearPreviewInterval = () => {
    if (previewInterval === undefined) return;
    window.clearInterval(previewInterval);
    previewInterval = undefined;
  };

  const appendPreviewMessage = () => {
    if (!previewService || previewDestroyed) return;

    const nextMsg = nextPreviewMessage(
      channel,
      previewService,
      previewChannelId,
      previewDemoKind,
    );
    mentionStyleService.registerMessageAuthor(nextMsg);
    setMessages((current) => {
      const next = [...current, nextMsg];
      return next.length > 30 ? next.slice(-30) : next;
    });
    previewService.scrollToLatest(
      getAnimationScrollBehavior(activePreviewConfig.animation),
    );
  };

  const restartPreviewInterval = () => {
    clearPreviewInterval();
    if (!previewReady) return;

    const intervalMs = messageSpeedToIntervalMs(
      activePreviewConfig.messageSpeed,
    );
    if (intervalMs !== null) {
      previewInterval = window.setInterval(appendPreviewMessage, intervalMs);
    }
  };

  const hasSameDataSource = (nextConfig: ChatConfig) =>
    nextConfig.channel === activePreviewConfig.channel &&
    nextConfig.youtubeChannel === activePreviewConfig.youtubeChannel &&
    nextConfig.youtubeWebSocketUrl === activePreviewConfig.youtubeWebSocketUrl &&
    nextConfig.show7tvUnlisted === activePreviewConfig.show7tvUnlisted;

  const handlePreviewConfigMessage = (event: MessageEvent<unknown>) => {
    if (
      window.parent === window ||
      event.source !== window.parent ||
      event.origin !== window.location.origin ||
      !isChatPreviewConfigMessage(event.data) ||
      !hasSameDataSource(event.data.config)
    ) {
      return;
    }

    const nextConfig = event.data.config;
    if (!isPreview) {
      runtime?.updateConfig(nextConfig);
      setConfig(nextConfig);
      return;
    }

    setRteProxyEnabled(nextConfig.rteProxy);
    const speedChanged =
      activePreviewConfig.messageSpeed !== nextConfig.messageSpeed;
    activePreviewConfig = nextConfig;
    setConfig(nextConfig);
    injectPreviewStyles(nextConfig);

    if (previewService) {
      const presentationConfig = createChatPresentationConfig(nextConfig);
      presentationConfig.userId = previewChannelId;
      previewService.updateConfig(presentationConfig);
      setAnimationDurationMs(
        hasMessageEntryAnimation(nextConfig.animation)
          ? presentationConfig.animation.duration
          : 0,
      );
      previewService.scrollToLatest(
        getAnimationScrollBehavior(nextConfig.animation),
      );
    }

    if (speedChanged) restartPreviewInterval();
  };

  const overlayRootStyle = createMemo(() => {
    const cfg = config() ?? initialConfig;
    return {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      "max-height": "100vh",
      display: "flex",
      "flex-direction": "column",
      "align-items": "stretch",
      "justify-content":
        cfg.reverseLineOrder && !cfg.horizontal ? "flex-start" : "flex-end",
      padding: "10px",
      "box-sizing": "border-box",
      "z-index": "10000",
      "pointer-events": "none",
      opacity: chatVisible() ? "1" : "0",
      overflow: "hidden",
      transition: "opacity 0.5s ease-in",
    } as const;
  });

  const chromeStyle = createMemo(() => {
    const cfg = config() ?? initialConfig;
    const withPrediction = hasPredictionBar();
    const chromeVisible = hasMessages() || withPrediction;
    const bgOpacity = clamp(cfg.overlayBackgroundOpacity, 0, 100) / 100;
    const borderOpacity = clamp(cfg.overlayBorderOpacity, 0, 100) / 100;
    const borderRadius = clamp(cfg.overlayBackgroundRadius, 0, 128);
    const fadeDurationMs = chatService()?.getConfig().fade.fadeOutDuration ?? 1000;

    return {
      position: "relative",
      width: "100%",
      "max-width": "100%",
      "max-height": "calc(100vh - 20px)",
      display: "block",
      "flex-shrink": "1",
      "min-height": withPrediction && !hasMessages() ? "72px" : "0",
      padding: "0",
      "box-sizing": "border-box",
      "pointer-events": "none",
      overflow: "hidden",
      transition: [
        `background-color ${fadeDurationMs}ms ease-out`,
        `border-color ${fadeDurationMs}ms ease-out`,
      ].join(", "),
      "background-color": `rgba(${hexToRgb(cfg.overlayBackgroundColor)}, ${chromeVisible ? bgOpacity : 0})`,
      border: chromeVisible && borderOpacity > 0
        ? `1px solid rgba(255, 255, 255, ${borderOpacity})`
        : "1px solid transparent",
      "border-radius": chromeVisible ? `${borderRadius}px` : "0px",
    } as const;
  });

  const containerStyle = createMemo(() => ({
    position: "relative",
    width: "100%",
    "max-width": "100%",
    "max-height": "100%",
    padding: "0",
    "box-sizing": "border-box",
    "pointer-events": "none",
    overflow: "hidden",
    "z-index": "1",
  }) as const);

  createEffect(() => {
    document.title = pageTitle();
  });

  onMount(() => {
    window.addEventListener("message", handlePreviewConfigMessage);

    if (isPreview) {
      const previewConfig = parseChatConfigFromSearchParams(urlParams, { channel });
      activePreviewConfig = previewConfig;
      setRteProxyEnabled(previewConfig.rteProxy);
      previewService = new ChatPresentationService(
        createChatPresentationConfig(previewConfig),
      );

      mentionStyleService.reset();
      previewService.updateConfig({ userId: "0" });

      setConfig(previewConfig);
      const previewAnimationDuration = hasMessageEntryAnimation(
        previewConfig.animation,
      )
        ? previewService.getConfig().animation.duration
        : 0;
      const previewIntervalMs = messageSpeedToIntervalMs(
        previewConfig.messageSpeed,
      );

      setChatService(previewService);
      setAnimationDurationMs(previewAnimationDuration);
      setChannelDisplayName(channel);
      setIsConnected(true);
      const previewContainer = document.getElementById("chat_container");
      if (previewContainer) {
        previewService.initializeLayout(previewContainer);
      }
      injectPreviewStyles(previewConfig);

      void (async () => {
        const isRealChannel = Boolean(channel && channel !== "chatyxpreview");
        setLoadingStatus("Preparing preview...");
        setLoadingProgress(25);

        previewChannelId = isRealChannel
          ? await withTimeout(resolveChannelId(channel), 8000, "0")
          : "0";

        setLoadingStatus("Loading preview data...");
        setLoadingProgress(55);

        const hasResolvedChannelId = isTwitchUserId(previewChannelId);
        const bgLoading = Promise.allSettled([
          withTimeout(
            emoteService.loadEmotes(previewChannelId, channel, {
              show7tvUnlisted: previewConfig.show7tvUnlisted,
            }),
            12000,
            undefined,
          ),
          ...(isRealChannel && hasResolvedChannelId
            ? [
                withTimeout(
                  badgeService.loadBadges(channel, previewChannelId),
                  10000,
                  undefined,
                ),
                withTimeout(
                  sevenTVCosmeticsService.loadCosmetics(previewChannelId),
                  10000,
                  undefined,
                ),
              ]
            : []),
        ]);

        if (isRealChannel) {
          await withTimeout(
            fetchChannelUsers(channel, hasResolvedChannelId ? previewChannelId : "0"),
            10000,
            undefined,
          );
        }
        await bgLoading;

        setLoadingStatus("Rendering preview...");
        setLoadingProgress(85);

        window.setTimeout(() => {
          if (previewDestroyed) return;
          const service = previewService;
          if (!service) return;

          const previewMessages = createPreviewMessages(
            channel,
            service,
            previewChannelId,
            previewDemoKind,
          );
          previewMessages.forEach((msg) => mentionStyleService.registerMessageAuthor(msg));

          setMessages(previewMessages);
          service.scrollToLatest(
            getAnimationScrollBehavior(previewConfig.animation),
          );
          setLoadingProgress(100);
          setLoadingStatus("Preview ready");
          setIsLoading(false);
          previewReady = true;
          if (previewIntervalMs !== null) restartPreviewInterval();
        }, 700);
      })().catch((error) => {
        console.error("[Preview] Initialization failed:", error);
        setLoadingStatus("Preview failed to load");
        setLoadingProgress(100);
        setIsLoading(false);
      });

      onCleanup(() => {
        previewDestroyed = true;
        clearPreviewInterval();
        clearPredictionClock();
        stopPredictionsClient();
        cleanupPreviewStyles();
      });

      return;
    }

    if (!hasChannel || !runtime) {
      // Channel parameter required — URL will show error state;
      return;
    }

    setConfig(initialConfig);
    void runtime.initialize();
  });

  onCleanup(() => {
    window.removeEventListener("message", handlePreviewConfigMessage);
    clearPredictionClock();
    stopPredictionsClient();
    runtime?.destroy();
    if (isPreview) chatService()?.cleanup();
  });

  return (
    <>
      <Title>{pageTitle()}</Title>
      <Show
        when={hasChannel}
        fallback={<div>Error: Channel parameter is required</div>}
      >
        <>
          <Show when={isLoading()}>
            <LoadingScreen
              progress={loadingProgress()}
              status={loadingStatus()}
              onComplete={() => setIsLoading(false)}
            />
          </Show>
          <div id="chat_overlay_root" style={overlayRootStyle()}>
            <div
              id="chat_chrome"
              classList={{ "has-prediction": hasPredictionBar() }}
              style={chromeStyle()}
            >
              <Show when={hasPredictionBar()}>
                <div class="chat-prediction-slot">
                  <PredictionProgressOverlay
                    event={prediction()}
                    now={predictionNow()}
                    variant="chat"
                  />
                </div>
              </Show>
              <div
                id="chat_container"
                data-connected={isConnected() ? "true" : "false"}
                style={containerStyle()}
              >
                <ChatMessageList
                  messages={messages()}
                  config={config()}
                  service={chatService()}
                  animationDurationMs={animationDurationMs()}
                  onMessageExpired={removeMessageById}
                />
              </div>
            </div>
          </div>
          <Show when={commandStatus()}>
            {(status) => (
              <LoadingScreen progress={0} status={status().text} overlay />
            )}
          </Show>
        </>
      </Show>
      <Show when={isDebug}>
        <PerfMonitor />
      </Show>
    </>
  );
}
