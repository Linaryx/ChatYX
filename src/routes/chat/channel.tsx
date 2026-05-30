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
} from "~/services/chat/preview";

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
  const [animationDurationMs, setAnimationDurationMs] = createSignal(380);
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
      position: "fixed",
      inset: "0",
      "z-index": "9999",
      "pointer-events": "none",
      opacity: chatVisible() ? "1" : "0",
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
      "box-sizing": "border-box",
    } as const;
  });

  const containerStyle = createMemo(() => ({
    position: "absolute",
    bottom: "0",
    width: "100%",
    padding: "10px",
    "box-sizing": "border-box",
    "z-index": "10000",
    "pointer-events": "auto",
    opacity: chatVisible() ? "1" : "0",
    transition: "opacity 0.5s ease-in",
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
      let previewInterval: number | undefined;
      let previewDestroyed = false;

      mentionStyleService.reset();
      injectPreviewStyles(previewConfig);
      previewService.updateConfig({ userId: "0" });

      setConfig(previewConfig);
      setChatService(previewService);
      setAnimationDurationMs(previewConfig.animate ? 200 : 0);
      setChannelDisplayName(channel);
      setIsConnected(true);

      void (async () => {
        const isRealChannel = Boolean(channel && channel !== "chatyxpreview");
        setLoadingStatus("Preparing preview...");
        setLoadingProgress(25);

        const previewChannelId = isRealChannel
          ? await withTimeout(resolveChannelId(channel), 2500, "0")
          : "0";

        setLoadingStatus("Loading preview data...");
        setLoadingProgress(55);

        const channelIdOrName = previewChannelId !== "0" ? previewChannelId : channel;
        const bgLoading = Promise.allSettled([
          withTimeout(
            emoteService.loadEmotes(previewChannelId, channel, {
              show7tvUnlisted: previewConfig.show7tvUnlisted,
            }),
            5000,
            undefined,
          ),
          ...(isRealChannel
            ? [
                withTimeout(
                  badgeService.loadBadges(channel, channelIdOrName),
                  4500,
                  undefined,
                ),
                withTimeout(
                  colorService.loadCosmetics(channelIdOrName),
                  4500,
                  undefined,
                ),
              ]
            : []),
        ]);

        if (isRealChannel) {
          await withTimeout(
            fetchChannelUsers(channel, channelIdOrName),
            4500,
            undefined,
          );
        }
        await bgLoading;

        setLoadingStatus("Rendering preview...");
        setLoadingProgress(85);

        window.setTimeout(() => {
          if (previewDestroyed) return;

          const previewMessages = createPreviewMessages(channel, previewService, previewChannelId);
          previewMessages.forEach((msg) => mentionStyleService.registerMessageAuthor(msg));

          setMessages(previewMessages);
          setAnimatedIds(new Set(previewMessages.map((msg) => msg.id)));
          setLoadingProgress(100);
          setLoadingStatus("Preview ready");
          setIsLoading(false);

          previewInterval = window.setInterval(() => {
            const nextMsg = nextPreviewMessage(channel, previewService, previewChannelId);
            mentionStyleService.registerMessageAuthor(nextMsg);

            setMessages((current) => {
              const next = [...current, nextMsg];
              return next.length > 8 ? next.slice(-8) : next;
            });

            if (previewConfig.animate) {
              setAnimatedIds((prev) => new Set([...prev, nextMsg.id]));
              window.setTimeout(() => {
                setAnimatedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(nextMsg.id);
                  return next;
                });
              }, 240);
            }
          }, 2400);
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
          <div id="chat_chrome" style={chromeStyle()} />
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
        </>
      </Show>
      <Show when={isDebug}>
        <PerfMonitor />
      </Show>
    </>
  );
}
