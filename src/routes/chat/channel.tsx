import {
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
import { PredictionProgressOverlay } from "~/components/predictions/PredictionProgressOverlay";
import { parseChatConfigFromSearchParams } from "~/config/chatUrlParams";
import {
  type ChatPresentationService,
  type TwitchMessage,
} from "~/services/chat";
import type { TwitchPredictionEvent } from "~/services/predictions/twitchPredictions";
import "~/styles/chat.css";
import type { ChatConfig } from "~/utils/chat";
import type { PreviewDemoKind } from "~/services/chat/preview";
import { DEFAULT_ANIMATION_OPTIONS } from "~/utils/ui/animationUtils";
import {
  createChatOverlayApplication,
  type ChatCommandStatus,
  createChromeStyle,
  createContainerStyle,
  createLoadingBackground,
  createOverlayRootStyle,
  createSurfaceStyle,
} from "~/features/chat-overlay";

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
  const runtimeConfig = isPreview
    ? parseChatConfigFromSearchParams(urlParams, { channel })
    : initialConfig;
  const hasChannel = Boolean(
    channel || initialConfig.youtubeChannel || initialConfig.kickChannel,
  );

  const [channelDisplayName, setChannelDisplayName] = createSignal("");
  const [config, setConfig] = createSignal<ChatConfig | null>(null);
  const [messages, setMessages] = createSignal<TwitchMessage[]>([]);
  const [isConnected, setIsConnected] = createSignal(false);
  const [chatService, setChatService] = createSignal<ChatPresentationService | null>(null);
  const [animationDurationMs, setAnimationDurationMs] = createSignal(
    DEFAULT_ANIMATION_OPTIONS.duration,
  );
  const [loadingProgress, setLoadingProgress] = createSignal(0);
  const [loadingStatus, setLoadingStatus] = createSignal("Подготавливаем чат...");
  const [isLoading, setIsLoading] = createSignal(true);
  const [commandStatus, setCommandStatus] = createSignal<ChatCommandStatus | null>(null);
  const [prediction, setPrediction] = createSignal<TwitchPredictionEvent | null>(
    null,
  );
  const [predictionNow, setPredictionNow] = createSignal(Date.now());
  const previewDemoKind = parsePreviewDemoKind(urlParams.get("demo"));

  const application = hasChannel
    ? createChatOverlayApplication(
        {
          channel,
          initialConfig: runtimeConfig,
          mode: isPreview ? "preview" : "live",
          previewDemoKind,
        },
        {
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
          onPredictionChange: setPrediction,
          onPredictionTimeChange: setPredictionNow,
          onLoadingComplete: () => setIsLoading(false),
        },
      )
    : null;

  const pageTitle = createMemo(() => {
    if (!hasChannel) return "ChatYX";
    if (isPreview) return "ChatYX • Preview";
    return `ChatYX • ${channelDisplayName() || channel || initialConfig.youtubeChannel || initialConfig.kickChannel}`;
  });
  const chatVisible = createMemo(() => !isLoading() || loadingProgress() >= 100);

  const showPredictionsBar = createMemo(
    () => Boolean((config() ?? runtimeConfig).showPredictions) && Boolean(channel),
  );
  const hasPredictionBar = createMemo(
    () => showPredictionsBar() && Boolean(prediction()),
  );
  const removeMessageById = (messageId: string) => {
    setMessages((current) =>
      current.filter((message) => message.id !== messageId),
    );
  };

  const overlayRootStyle = createMemo(() =>
    createOverlayRootStyle(chatVisible()),
  );

  const surfaceStyle = createMemo(() => {
    const cfg = config() ?? runtimeConfig;
    const fadeDurationMs = chatService()?.getConfig().fade.fadeOutDuration ?? 1000;
    return createSurfaceStyle(cfg, fadeDurationMs);
  });

  const chromeStyle = createChromeStyle();

  const loadingBackground = createMemo(() =>
    createLoadingBackground(config() ?? runtimeConfig),
  );

  const containerStyle = createContainerStyle();

  onMount(() => {
    if (!application) {
      // Channel parameter required — URL will show error state;
      return;
    }
    void application.start();
  });

  onCleanup(() => {
    application?.destroy();
  });

  return (
    <>
      <Title>{pageTitle()}</Title>
      <Show
        when={hasChannel}
        fallback={<div>Укажи канал в параметре ссылки</div>}
      >
        <>
          <Show when={isLoading()}>
            <LoadingScreen
              progress={loadingProgress()}
              status={loadingStatus()}
              onComplete={() => setIsLoading(false)}
              background={loadingBackground()}
            />
          </Show>
          <div id="chat_overlay_root" style={overlayRootStyle()}>
            <div id="chat_surface" style={surfaceStyle()}>
              <div
                id="chat_chrome"
                classList={{ "has-prediction": hasPredictionBar() }}
                style={chromeStyle}
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
                  style={containerStyle}
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
          </div>
          <Show when={commandStatus()}>
            {(status) => (
              <LoadingScreen
                progress={0}
                status={status().text}
                overlay
                background={loadingBackground()}
              />
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
