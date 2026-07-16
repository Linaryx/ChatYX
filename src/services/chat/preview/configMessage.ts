import type { ChatConfig } from "~/utils/chat";
import type { PreviewDemoKind } from "./messages";

export const CHAT_PREVIEW_CONFIG_MESSAGE = "chatyx:preview-config";

export type ChatPreviewMode = "live" | "demo";

export type ChatPreviewConfigMessage = {
  type: typeof CHAT_PREVIEW_CONFIG_MESSAGE;
  config: ChatConfig;
};

export function createChatPreviewConfigMessage(
  config: ChatConfig,
): ChatPreviewConfigMessage {
  return {
    type: CHAT_PREVIEW_CONFIG_MESSAGE,
    config,
  };
}

export function isChatPreviewConfigMessage(
  value: unknown,
): value is ChatPreviewConfigMessage {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ChatPreviewConfigMessage>;
  return (
    candidate.type === CHAT_PREVIEW_CONFIG_MESSAGE &&
    Boolean(candidate.config) &&
    typeof candidate.config === "object" &&
    typeof candidate.config.channel === "string" &&
    typeof candidate.config.youtubeChannel === "string" &&
    typeof candidate.config.size === "number"
  );
}

export function getChatPreviewSessionKey(
  config: ChatConfig,
  mode: ChatPreviewMode,
  demoKind: PreviewDemoKind,
): string {
  return JSON.stringify({
    mode,
    demoKind: mode === "demo" ? demoKind : null,
    channel: config.channel,
    youtubeChannel: config.youtubeChannel,
    youtubeWebSocketUrl: config.youtubeWebSocketUrl,
    show7tvUnlisted: config.show7tvUnlisted,
  });
}
