import { LiveChatRuntime } from "./liveRuntime";
import {
  ChatOverlayApplication,
  type ChatOverlayApplicationHooks,
  type ChatOverlayApplicationOptions,
} from "./chatOverlayApplication";
import { PredictionController } from "./predictionController";
import { PreviewRuntime } from "./previewRuntime";

export function createChatOverlayApplication(
  options: ChatOverlayApplicationOptions,
  hooks: ChatOverlayApplicationHooks,
) {
  return new ChatOverlayApplication(options, hooks, {
    createLiveRuntime: (channel, runtimeHooks) =>
      new LiveChatRuntime(channel, runtimeHooks),
    createPreviewRuntime: (runtimeOptions, runtimeHooks) =>
      new PreviewRuntime(runtimeOptions, runtimeHooks),
    createPredictionsRuntime: (predictionHooks) =>
      new PredictionController(predictionHooks),
  });
}
