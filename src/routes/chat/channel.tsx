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
import { parseChatConfigFromSearchParams } from "~/config/chatUrlParams";
import {
  createFromQueryParams,
  OverlayRuntime,
  ChatISIntegrationService,
  emoteService,
  colorService,
  mentionStyleService,
  type TwitchMessage,
} from "~/services/chat";
import { badgeService } from "~/services/badges";
import "~/styles/chat.css";
import type { ChatConfig } from "~/utils/chat";
import {
  fetchChannelUsers,
  resolveChannelId,
  nextPreviewMessage,
  createPreviewMessages,
  injectPreviewStyles,
  cleanupPreviewStyles,
  type PreviewDemoKind,
} from "~/services/chat/preview";
import {
  DEFAULT_ANIMATION_OPTIONS,
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
  const hasChannel = Boolean(channel);

  const [channelDisplayName, setChannelDisplayName] = createSignal("");
  const [config, setConfig] = createSignal<ChatConfig | null>(null);
  const [messages, setMessages] = createSignal<TwitchMessage[]>([]);
  const [isConnected, setIsConnected] = createSignal(false);
  const [chatService, setChatService] = createSignal<ChatISIntegrationService | null>(null);
  const [animatedIds, setAnimatedIds] = createSignal<Set<string>>(new Set());
  const [animationDurationMs, setAnimationDurationMs] = createSignal(
    DEFAULT_ANIMATION_OPTIONS.duration,
  );
  const [loadingProgress, setLoadingProgress] = createSignal(0);
  const [loadingStatus, setLoadingStatus] = createSignal("Initializing...");
  const [isLoading, setIsLoading] = createSignal(true);
  const seenMessageIds = new Set<string>();

  const runtime =
    hasChannel && !isPreview
      ? new OverlayRuntime(channel, {
          onConfigResolved: setConfig,
          onServiceReady: setChatService,
          onLoadingChange: ({ status, progress }) => {
            setLoadingStatus(status);
            setLoadingProgress(progress);
          },
          onConnectionChange: setIsConnected,
          onMessagesChange: (updater) => setMessages(updater),
          onAnimationDurationChange: setAnimationDurationMs,
          onChannelResolved: ({ displayName }) => setChannelDisplayName(displayName),
        })
      : null;

  const pageTitle = createMemo(() => {
    if (!hasChannel) return "ChatYX";
    if (isPreview) return "ChatYX • Preview";
    return `ChatYX • ${channelDisplayName() || channel}`;
  });
  const chatVisible = createMemo(() => !isLoading() || loadingProgress() >= 100);
  const hasMessages = createMemo(() => messages().length > 0);

  const chromeStyle = createMemo(() => {
    const cfg = config() ?? initialConfig;
    const chromeVisible = hasMessages();
    const bgOpacity = clamp(cfg.overlayBackgroundOpacity, 0, 100) / 100;
    const borderOpacity = clamp(cfg.overlayBorderOpacity, 0, 100) / 100;
    const borderRadius = clamp(cfg.overlayBackgroundRadius, 0, 128);
    const fadeDurationMs = chatService()?.getConfig().fade.fadeOutDuration ?? 1000;

    return {
      position: "absolute",
      bottom: "0",
      left: "0",
      width: "fit-content",
      "max-width": "100%",
      "max-height": "100vh",
      padding: "10px",
      "box-sizing": "border-box",
      "z-index": "10000",
      "pointer-events": "none",
      opacity: chatVisible() ? "1" : "0",
      overflow: "hidden",
      transition: [
        "opacity 0.5s ease-in",
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
    width: "fit-content",
    "max-width": "100%",
    "max-height": "calc(100vh - 20px)",
    padding: "0",
    "box-sizing": "border-box",
    "pointer-events": "none",
  }) as const);

  createEffect(() => {
    document.title = pageTitle();
  });

  createEffect(() => {
    const currentMessages = messages();
    const currentIds = new Set<string>();
    const pendingAnimations: string[] = [];

    currentMessages.forEach((msg) => {
      currentIds.add(msg.id);
      if (!seenMessageIds.has(msg.id)) {
        seenMessageIds.add(msg.id);
        pendingAnimations.push(msg.id);
      }
    });

    if (pendingAnimations.length > 0 && config()?.animate) {
      const duration = animationDurationMs();
      setAnimatedIds((prev) => {
        const next = new Set(prev);
        pendingAnimations.forEach((id) => next.add(id));
        return next;
      });
      window.setTimeout(() => {
        setAnimatedIds((prev) => {
          const next = new Set(prev);
          pendingAnimations.forEach((id) => next.delete(id));
          return next;
        });
      }, duration + 40);
    }

    seenMessageIds.forEach((id) => {
      if (!currentIds.has(id)) seenMessageIds.delete(id);
    });
  });

  onMount(() => {
    if (isPreview) {
      const previewConfig = parseChatConfigFromSearchParams(urlParams, { channel });
      const previewService = new ChatISIntegrationService(createFromQueryParams(previewConfig));
      const previewDemoKind = parsePreviewDemoKind(urlParams.get("demo"));
      let previewInterval: number | undefined;
      let previewDestroyed = false;
      const scrollPreviewToLatest = () => {
        window.requestAnimationFrame(() => {
          if (!previewDestroyed) previewService.scrollToLatest(false);
        });
      };

      mentionStyleService.reset();
      injectPreviewStyles(previewConfig);
      previewService.updateConfig({ userId: "0" });

      setConfig(previewConfig);
      const previewAnimationDuration = previewConfig.animate
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

      void (async () => {
        const isRealChannel = Boolean(channel && channel !== "chatyxpreview");
        setLoadingStatus("Preparing preview...");
        setLoadingProgress(25);

        const previewChannelId = isRealChannel
          ? await withTimeout(resolveChannelId(channel), 2500, "0")
          : "0";

        setLoadingStatus("Loading preview data...");
        setLoadingProgress(55);

        const hasResolvedChannelId = isTwitchUserId(previewChannelId);
        const bgLoading = Promise.allSettled([
          withTimeout(
            emoteService.loadEmotes(previewChannelId, channel, {
              show7tvUnlisted: previewConfig.show7tvUnlisted,
            }),
            5000,
            undefined,
          ),
          ...(isRealChannel && hasResolvedChannelId
            ? [
                withTimeout(
                  badgeService.loadBadges(channel, previewChannelId),
                  4500,
                  undefined,
                ),
                withTimeout(
                  colorService.loadCosmetics(previewChannelId),
                  4500,
                  undefined,
                ),
              ]
            : []),
        ]);

        if (isRealChannel) {
          await withTimeout(
            fetchChannelUsers(channel, hasResolvedChannelId ? previewChannelId : "0"),
            4500,
            undefined,
          );
        }
        await bgLoading;

        setLoadingStatus("Rendering preview...");
        setLoadingProgress(85);

        window.setTimeout(() => {
          if (previewDestroyed) return;

          const previewMessages = createPreviewMessages(
            channel,
            previewService,
            previewChannelId,
            previewDemoKind,
          );
          previewMessages.forEach((msg) => mentionStyleService.registerMessageAuthor(msg));

          setMessages(previewMessages);
          setAnimatedIds(new Set(previewMessages.map((msg) => msg.id)));
          scrollPreviewToLatest();
          setLoadingProgress(100);
          setLoadingStatus("Preview ready");
          setIsLoading(false);

          if (previewIntervalMs === null) return;

          previewInterval = window.setInterval(() => {
            const nextMsg = nextPreviewMessage(
              channel,
              previewService,
              previewChannelId,
              previewDemoKind,
            );
            mentionStyleService.registerMessageAuthor(nextMsg);

            setMessages((current) => {
              const next = [...current, nextMsg];
              return next.length > 8 ? next.slice(-8) : next;
            });
            scrollPreviewToLatest();

            if (previewConfig.animate) {
              setAnimatedIds((prev) => new Set([...prev, nextMsg.id]));
              window.setTimeout(() => {
                setAnimatedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(nextMsg.id);
                  return next;
                });
              }, previewAnimationDuration + 40);
            }
          }, previewIntervalMs);
        }, 700);
      })().catch((error) => {
        console.error("[Preview] Initialization failed:", error);
        setLoadingStatus("Preview failed to load");
        setLoadingProgress(100);
        setIsLoading(false);
      });

      onCleanup(() => {
        previewDestroyed = true;
        if (previewInterval !== undefined) window.clearInterval(previewInterval);
        cleanupPreviewStyles();
      });

      return;
    }

    if (!hasChannel || !runtime) {
      // Channel parameter required — URL will show error state;
      return;
    }

    void runtime.initialize();
  });

  onCleanup(() => {
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
          <div id="chat_chrome" style={chromeStyle()}>
            <div
              id="chat_container"
              data-connected={isConnected() ? "true" : "false"}
              style={containerStyle()}
            >
              <ChatMessageList
                messages={messages()}
                config={config()}
                service={chatService()}
                animatedIds={animatedIds()}
                animationDurationMs={animationDurationMs()}
              />
            </div>
          </div>
        </>
      </Show>
      <Show when={isDebug}>
        <PerfMonitor />
      </Show>
    </>
  );
}
