import type { ChatConfig } from "~/config/chatUrlParams";
import { getAnimationScrollBehavior } from "~/utils/ui/animationUtils";
import type { ChatPresentationService } from "../chatPresentationService";
import type { TwitchMessage } from "../twitchService";

export type MessageUpdater = (messages: TwitchMessage[]) => TwitchMessage[];

type MessageRefreshPatch = Partial<
  Pick<
    TwitchMessage,
    | "displayName"
    | "color"
    | "badges"
    | "sourceChannelLogin"
    | "sourceChannelDisplayName"
    | "sourceChannelAvatarUrl"
    | "showSourceChannelBadge"
  >
>;

type MessageQueueManagerOptions = {
  getConfig: () => ChatConfig | null;
  getService: () => ChatPresentationService | null;
  onAnimationDurationChange: (durationMs: number) => void;
  onMessagesChange: (updater: MessageUpdater) => void;
};

function getAdaptiveAnimationDuration(
  baseDuration: number,
  messagesPerSecond: number,
) {
  if (messagesPerSecond <= 6) return baseDuration;
  const scale = Math.max(0.55, 1 - (messagesPerSecond - 6) * 0.035);
  return Math.max(120, Math.round(baseDuration * scale));
}

export class MessageQueueManager {
  private readonly recentMessageTimes: number[] = [];
  private readonly pendingMessages: TwitchMessage[] = [];
  private readonly pendingRefreshes = new Map<string, MessageRefreshPatch>();
  private messageFrame: number | null = null;
  private refreshFrame: number | null = null;

  constructor(private readonly options: MessageQueueManagerOptions) {}

  append(message: TwitchMessage) {
    const now = Date.now();
    this.recentMessageTimes.push(now);
    while (
      this.recentMessageTimes.length > 0 &&
      now - this.recentMessageTimes[0] > 1000
    ) {
      this.recentMessageTimes.shift();
    }

    this.pendingMessages.push(message);
    if (this.messageFrame !== null) return;

    this.messageFrame = window.requestAnimationFrame(() => {
      this.messageFrame = null;
      const batch = this.pendingMessages.splice(0);
      if (batch.length === 0) return;

      this.options.onMessagesChange((messages) => {
        const nextMessages = [...messages, ...batch];
        return nextMessages.length > 100 ? nextMessages.slice(-100) : nextMessages;
      });

      const service = this.options.getService();
      const config = this.options.getConfig();
      const baseDuration = service?.getConfig().animation.duration ?? 380;
      this.options.onAnimationDurationChange(
        getAdaptiveAnimationDuration(
          baseDuration,
          this.recentMessageTimes.length,
        ),
      );

      if (service && config) {
        service.scrollToLatest(getAnimationScrollBehavior(config.animation));
      }
    });
  }

  discard(predicate: (message: TwitchMessage) => boolean) {
    for (let index = this.pendingMessages.length - 1; index >= 0; index -= 1) {
      if (predicate(this.pendingMessages[index])) {
        this.pendingMessages.splice(index, 1);
      }
    }

    if (this.pendingMessages.length === 0 && this.messageFrame !== null) {
      window.cancelAnimationFrame(this.messageFrame);
      this.messageFrame = null;
    }
  }

  clear() {
    this.pendingMessages.length = 0;
    if (this.messageFrame !== null) {
      window.cancelAnimationFrame(this.messageFrame);
      this.messageFrame = null;
    }
  }

  queueRefresh(messageId: string, patch: MessageRefreshPatch = {}) {
    const existingPatch = this.pendingRefreshes.get(messageId) ?? {};
    this.pendingRefreshes.set(messageId, { ...existingPatch, ...patch });

    if (this.refreshFrame !== null) return;

    this.refreshFrame = window.requestAnimationFrame(() => {
      this.refreshFrame = null;
      const refreshes = new Map(this.pendingRefreshes);
      this.pendingRefreshes.clear();
      if (refreshes.size === 0) return;

      this.options.onMessagesChange((messages) => {
        let changed = false;
        const nextMessages = messages.map((message) => {
          if (!refreshes.has(message.id)) return message;
          changed = true;
          return { ...message, ...refreshes.get(message.id) };
        });
        return changed ? nextMessages : messages;
      });
    });
  }

  clearRefreshes() {
    this.pendingRefreshes.clear();
    if (this.refreshFrame !== null) {
      window.cancelAnimationFrame(this.refreshFrame);
      this.refreshFrame = null;
    }
  }

  getPendingMessages() {
    return this.pendingMessages as readonly TwitchMessage[];
  }

  captureVisibleMessages() {
    let snapshot: TwitchMessage[] = [];
    this.options.onMessagesChange((messages) => {
      snapshot = messages;
      return messages;
    });
    return snapshot;
  }

  refreshMessages(refresh: (message: TwitchMessage) => TwitchMessage) {
    for (let index = 0; index < this.pendingMessages.length; index += 1) {
      this.pendingMessages[index] = refresh(this.pendingMessages[index]);
    }
    this.options.onMessagesChange((messages) => messages.map(refresh));
  }

  destroy() {
    this.clear();
    this.clearRefreshes();
    this.recentMessageTimes.length = 0;
  }
}
