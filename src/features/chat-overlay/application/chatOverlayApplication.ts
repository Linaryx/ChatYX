import {
  isChatPreviewConfigMessage,
  type PreviewDemoKind,
} from "~/services/chat/preview";
import type { TwitchPredictionEvent } from "~/services/predictions/twitchPredictions";
import type { ChatConfig } from "~/utils/chat";
import type { PredictionControllerHooks } from "./predictionController";
import type { ChatRuntimeHooks } from "./runtimeHooks";
import {
  type PreviewRuntimeHooks,
  type PreviewRuntimeOptions,
} from "./previewRuntime";

export type ChatOverlayMode = "live" | "preview";

export type ChatOverlayApplicationOptions = {
  channel: string;
  initialConfig: ChatConfig;
  mode: ChatOverlayMode;
  previewDemoKind: PreviewDemoKind;
};

export type ChatOverlayApplicationHooks = ChatRuntimeHooks & {
  onPredictionChange: (prediction: TwitchPredictionEvent | null) => void;
  onPredictionTimeChange: (now: number) => void;
  onLoadingComplete: () => void;
};

type ChatRuntime = {
  initialize: () => Promise<void>;
  updateConfig: (config: ChatConfig) => void;
  destroy: () => void;
};

type PredictionsRuntime = {
  update: (config: ChatConfig, preview: boolean) => void;
  destroy: () => void;
};

export type ChatOverlayApplicationDependencies = {
  createLiveRuntime: (
    channel: string,
    hooks: ChatRuntimeHooks,
  ) => ChatRuntime;
  createPreviewRuntime: (
    options: PreviewRuntimeOptions,
    hooks: PreviewRuntimeHooks,
  ) => ChatRuntime;
  createPredictionsRuntime: (
    hooks: PredictionControllerHooks,
  ) => PredictionsRuntime;
};

function hasSameDataSource(current: ChatConfig, next: ChatConfig) {
  return (
    next.channel === current.channel &&
    next.youtubeChannel === current.youtubeChannel &&
    next.youtubeWebSocketUrl === current.youtubeWebSocketUrl &&
    next.kickChannel === current.kickChannel &&
    next.kickWebSocketUrl === current.kickWebSocketUrl &&
    next.show7tvUnlisted === current.show7tvUnlisted
  );
}

export class ChatOverlayApplication {
  private readonly runtime: ChatRuntime;
  private readonly predictions: PredictionsRuntime;
  private config: ChatConfig;
  private started = false;

  constructor(
    private readonly options: ChatOverlayApplicationOptions,
    private readonly hooks: ChatOverlayApplicationHooks,
    dependencies: ChatOverlayApplicationDependencies,
  ) {
    this.config = options.initialConfig;
    this.predictions = dependencies.createPredictionsRuntime({
      onPredictionChange: hooks.onPredictionChange,
      onTimeChange: hooks.onPredictionTimeChange,
      onError: (error) => console.warn("[Predictions]", error.message),
    });

    const runtimeHooks: ChatRuntimeHooks = {
      ...hooks,
      onConfigResolved: (config) => this.handleConfigResolved(config),
    };
    this.runtime = options.mode === "preview"
      ? dependencies.createPreviewRuntime(
          {
            channel: options.channel,
            initialConfig: options.initialConfig,
            demoKind: options.previewDemoKind,
          },
          {
            onConfigResolved: runtimeHooks.onConfigResolved,
            onServiceReady: runtimeHooks.onServiceReady,
            onLoadingChange: runtimeHooks.onLoadingChange,
            onConnectionChange: runtimeHooks.onConnectionChange,
            onMessagesChange: runtimeHooks.onMessagesChange,
            onAnimationDurationChange: runtimeHooks.onAnimationDurationChange,
            onChannelResolved: runtimeHooks.onChannelResolved,
            onLoadingComplete: hooks.onLoadingComplete,
          },
        )
      : dependencies.createLiveRuntime(options.channel, runtimeHooks);
  }

  async start() {
    if (this.started) return;
    this.started = true;
    window.addEventListener("message", this.handleConfigMessage);
    await this.runtime.initialize();
  }

  destroy() {
    if (!this.started) return;
    this.started = false;
    window.removeEventListener("message", this.handleConfigMessage);
    this.predictions.destroy();
    this.runtime.destroy();
  }

  private handleConfigResolved(config: ChatConfig) {
    this.config = config;
    this.predictions.update(config, this.options.mode === "preview");
    this.hooks.onConfigResolved(config);
  }

  private readonly handleConfigMessage = (event: MessageEvent<unknown>) => {
    if (
      window.parent === window ||
      event.source !== window.parent ||
      event.origin !== window.location.origin ||
      !isChatPreviewConfigMessage(event.data) ||
      !hasSameDataSource(this.config, event.data.config)
    ) {
      return;
    }

    this.runtime.updateConfig(event.data.config);
  };
}
