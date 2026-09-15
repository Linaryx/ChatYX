import type { ChatPresentationService } from "~/services/chat/chatPresentationService";
import type { MessageUpdater } from "~/services/chat/runtime/messageQueueManager";
import type { ChannelIdentity } from "~/services/chat/runtime/channelIdentityResolver";
import type { ChatConfig } from "~/utils/chat";

export type ChatCommandStatus = {
  text: string;
};

export type LoadingState = {
  status: string;
  progress: number;
};

export type ChatRuntimeHooks = {
  onConfigResolved: (config: ChatConfig) => void;
  onServiceReady: (service: ChatPresentationService) => void;
  onLoadingChange: (state: LoadingState) => void;
  onCommandStatusChange: (status: ChatCommandStatus | null) => void;
  onConnectionChange: (connected: boolean) => void;
  onMessagesChange: (updater: MessageUpdater) => void;
  onAnimationDurationChange: (durationMs: number) => void;
  onChannelResolved: (resolution: ChannelIdentity) => void;
};
