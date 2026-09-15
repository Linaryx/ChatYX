import { createPreviewPredictionEvent } from "~/services/predictions/previewPrediction";
import {
  createTwitchPredictionsClient,
  type TwitchPredictionEvent,
  type TwitchPredictionsClient,
} from "~/services/predictions/twitchPredictions";
import type { ChatConfig } from "~/utils/chat";

export type PredictionControllerHooks = {
  onPredictionChange: (prediction: TwitchPredictionEvent | null) => void;
  onTimeChange: (now: number) => void;
  onError?: (error: Error) => void;
};

export type PredictionControllerDependencies = {
  createClient: typeof createTwitchPredictionsClient;
  createPreviewEvent: typeof createPreviewPredictionEvent;
  setInterval: (callback: () => void, delay: number) => number;
  clearInterval: (id: number) => void;
  now: () => number;
};

const browserDependencies: PredictionControllerDependencies = {
  createClient: createTwitchPredictionsClient,
  createPreviewEvent: createPreviewPredictionEvent,
  setInterval: (callback, delay) => window.setInterval(callback, delay),
  clearInterval: (id) => window.clearInterval(id),
  now: () => Date.now(),
};

export class PredictionController {
  private client: TwitchPredictionsClient | null = null;
  private activeChannel = "";
  private clock: number | null = null;

  constructor(
    private readonly hooks: PredictionControllerHooks,
    private readonly dependencies = browserDependencies,
  ) {}

  update(config: ChatConfig, preview: boolean) {
    const channel = config.channel.trim().toLowerCase();
    if (!config.showPredictions || !channel) {
      this.stopClient();
      this.stopClock();
      this.hooks.onPredictionChange(null);
      return;
    }

    this.startClock();
    if (preview) {
      this.stopClient();
      this.hooks.onPredictionChange(
        this.dependencies.createPreviewEvent(this.dependencies.now()),
      );
      return;
    }

    if (this.client && this.activeChannel === channel) return;

    this.stopClient();
    this.client = this.dependencies.createClient({
      channelLogin: channel,
      onPrediction: this.hooks.onPredictionChange,
      onError: (error) => this.hooks.onError?.(error),
    });
    this.activeChannel = channel;
    this.client.start();
  }

  destroy() {
    this.stopClient();
    this.stopClock();
  }

  private startClock() {
    if (this.clock !== null) return;
    this.clock = this.dependencies.setInterval(
      () => this.hooks.onTimeChange(this.dependencies.now()),
      1000,
    );
  }

  private stopClock() {
    if (this.clock === null) return;
    this.dependencies.clearInterval(this.clock);
    this.clock = null;
  }

  private stopClient() {
    this.client?.stop();
    this.client = null;
    this.activeChannel = "";
  }
}
