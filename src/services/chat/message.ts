import type { ReplyThread } from "~/types/replyThread";
import type { MessageTokenSnapshot } from "~/utils/chat/emojiUtils";

export type ChatPlatform = "twitch" | "youtube" | "kick";

export type TwitchEventType =
  | "first-message"
  | "raid"
  | "subscription"
  | "watch-streak"
  | "highlighted-message"
  | "reward"
  | "power-up"
  | "announcement";

export type TwitchEvent = {
  type: TwitchEventType;
  label: string;
  detail?: string;
  level?: string;
  count?: number;
  points?: number;
  color?: string;
};

export type ChatGif = {
  start: number;
  end: number;
  id: string;
  url: string;
};

// Shared normalized message shape used by every chat platform.
export interface ChatMessage {
  id: string;
  username: string;
  displayName: string;
  message: string;
  color: string;
  badges: string[];
  emotes: any;
  userType: string;
  isModerator: boolean;
  isSubscriber: boolean;
  timestamp: Date;
  platform: ChatPlatform;
  restored?: boolean;
  userId?: string;
  reply?: ReplyThread;
  msgId?: string;
  customRewardId?: string;
  channelPointReward?: { id: string; title: string; prompt: string; cost: number };
  gifs?: ChatGif[];
  platformBadges?: Array<{ url: string; title?: string }>;
  isGigantifiedEmote?: boolean;
  bits?: number;
  cheerPrefix?: string;
  emoteSnapshot?: Map<string, any>;
  tokenSnapshot?: MessageTokenSnapshot;
  sourceChannel?: string;
  sourceMessageId?: string;
  sourceChannelId?: string;
  targetChannelId?: string;
  targetBadges?: string[];
  sourceChannelLogin?: string;
  sourceChannelDisplayName?: string;
  sourceChannelAvatarUrl?: string;
  showSourceChannelBadge?: boolean;
  twitchEvent?: TwitchEvent;
}
