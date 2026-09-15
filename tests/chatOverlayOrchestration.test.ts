import { describe, expect, test } from "bun:test";
import { DEFAULT_CHAT_CONFIG, type ChatConfig } from "../src/config/chatUrlParams";
import {
  ChatOverlayApplication,
  type ChatOverlayApplicationDependencies,
  type ChatOverlayApplicationHooks,
} from "../src/features/chat-overlay/application/chatOverlayApplication";
import {
  PredictionController,
  type PredictionControllerDependencies,
} from "../src/features/chat-overlay/application/predictionController";
import { createPreviewPredictionEvent } from "../src/services/predictions/previewPrediction";
import type {
  TwitchPredictionEvent,
  TwitchPredictionsClientOptions,
} from "../src/services/predictions/twitchPredictions";

function config(overrides: Partial<ChatConfig> = {}): ChatConfig {
  return {
    ...DEFAULT_CHAT_CONFIG,
    channel: "streamer",
    showPredictions: true,
    ...overrides,
  };
}

describe("prediction controller", () => {
  test("owns one client and clock for the active channel", () => {
    const clients: Array<{
      options: TwitchPredictionsClientOptions;
      starts: number;
      stops: number;
    }> = [];
    const clearedIntervals: number[] = [];
    const predictions: Array<TwitchPredictionEvent | null> = [];
    const dependencies: PredictionControllerDependencies = {
      createClient: (options) => {
        const state = { options, starts: 0, stops: 0 };
        clients.push(state);
        return {
          start: () => {
            state.starts += 1;
          },
          stop: () => {
            state.stops += 1;
          },
          refresh: async () => {},
        };
      },
      createPreviewEvent: createPreviewPredictionEvent,
      setInterval: () => 7,
      clearInterval: (id) => clearedIntervals.push(id),
      now: () => 123,
    };
    const controller = new PredictionController(
      {
        onPredictionChange: (prediction) => predictions.push(prediction),
        onTimeChange: () => {},
      },
      dependencies,
    );

    controller.update(config(), false);
    controller.update(config({ fontWeight: 700 }), false);
    controller.update(config({ channel: "another" }), false);

    expect(clients).toHaveLength(2);
    expect(clients[0]).toMatchObject({ starts: 1, stops: 1 });
    expect(clients[1]).toMatchObject({ starts: 1, stops: 0 });

    controller.update(config({ channel: "another", showPredictions: false }), false);
    expect(clients[1].stops).toBe(1);
    expect(clearedIntervals).toEqual([7]);
    expect(predictions.at(-1)).toBeNull();
  });

  test("uses deterministic preview data without opening a client", () => {
    let clients = 0;
    const predictions: Array<TwitchPredictionEvent | null> = [];
    const controller = new PredictionController(
      {
        onPredictionChange: (prediction) => predictions.push(prediction),
        onTimeChange: () => {},
      },
      {
        createClient: (options) => {
          clients += 1;
          return {
            start: () => {},
            stop: () => {},
            refresh: async () => {},
          };
        },
        createPreviewEvent: createPreviewPredictionEvent,
        setInterval: () => 1,
        clearInterval: () => {},
        now: () => 1_000,
      },
    );

    controller.update(config(), true);

    expect(clients).toBe(0);
    expect(predictions[0]).toMatchObject({
      id: "preview-prediction",
      updatedAt: 1_000,
    });
  });
});

describe("chat overlay application", () => {
  test("owns runtime lifecycle and accepts only same-source parent updates", async () => {
    const originalWindow = globalThis.window;
    const parent = {} as Window;
    let messageListener: ((event: MessageEvent<unknown>) => void) | null = null;
    (globalThis as unknown as { window: Partial<Window> }).window = {
      parent,
      location: { origin: "https://chatyx.test" } as Location,
      addEventListener: (_type, listener) => {
        messageListener = listener as (event: MessageEvent<unknown>) => void;
      },
      removeEventListener: () => {
        messageListener = null;
      },
    };

    const initialConfig = config();
    const updates: ChatConfig[] = [];
    let runtimeStarts = 0;
    let runtimeStops = 0;
    let predictionStops = 0;
    const dependencies: ChatOverlayApplicationDependencies = {
      createLiveRuntime: (_channel, hooks) => ({
        initialize: async () => {
          runtimeStarts += 1;
          hooks.onConfigResolved(initialConfig);
        },
        updateConfig: (nextConfig) => updates.push(nextConfig),
        destroy: () => {
          runtimeStops += 1;
        },
      }),
      createPreviewRuntime: () => {
        throw new Error("preview runtime should not be created");
      },
      createPredictionsRuntime: () => ({
        update: () => {},
        destroy: () => {
          predictionStops += 1;
        },
      }),
    };
    const hooks = {
      onConfigResolved: () => {},
      onServiceReady: () => {},
      onLoadingChange: () => {},
      onCommandStatusChange: () => {},
      onConnectionChange: () => {},
      onMessagesChange: () => {},
      onAnimationDurationChange: () => {},
      onChannelResolved: () => {},
      onPredictionChange: () => {},
      onPredictionTimeChange: () => {},
      onLoadingComplete: () => {},
    } satisfies ChatOverlayApplicationHooks;
    const application = new ChatOverlayApplication(
      {
        channel: "streamer",
        initialConfig,
        mode: "live",
        previewDemoKind: "pasta",
      },
      hooks,
      dependencies,
    );

    try {
      await application.start();
      expect(runtimeStarts).toBe(1);
      expect(messageListener).not.toBeNull();

      messageListener?.({
        source: parent,
        origin: "https://chatyx.test",
        data: {
          type: "chatyx:preview-config",
          config: config({ size: 48 }),
        },
      } as MessageEvent<unknown>);
      messageListener?.({
        source: parent,
        origin: "https://chatyx.test",
        data: {
          type: "chatyx:preview-config",
          config: config({ channel: "other", size: 52 }),
        },
      } as MessageEvent<unknown>);

      expect(updates).toHaveLength(1);
      expect(updates[0].size).toBe(48);

      application.destroy();
      expect(runtimeStops).toBe(1);
      expect(predictionStops).toBe(1);
      expect(messageListener).toBeNull();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
