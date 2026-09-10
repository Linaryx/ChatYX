export type ChatSourcePlatform = "youtube" | "kick";

export type ChatSourceAuthor = {
  name: string;
  id?: string;
  color?: string;
  moderator?: boolean;
  subscriber?: boolean;
  badges?: Array<{ url: string; tooltip?: string }>;
};

export type ChatSourceMessage = {
  type: "message";
  platform: ChatSourcePlatform;
  id: string;
  message: string;
  runs?: unknown[];
  author: ChatSourceAuthor;
  reply?: {
    id: string;
    message: string;
    author: ChatSourceAuthor;
  };
  unix: number;
};

export type ChatSourceHistory = {
  type: "history";
  platform: ChatSourcePlatform;
  messages: ChatSourceMessage[];
};

export type ChatSourceEvent =
  | ChatSourceMessage
  | ChatSourceHistory
  | {
      type: "delete";
      platform: ChatSourcePlatform;
      messageId: string;
    }
  | {
      type: "ban";
      platform: ChatSourcePlatform;
      userId: string;
    }
  | {
      type: "status";
      platform: ChatSourcePlatform;
      state: "connected" | "error";
      error?: string;
      retryable?: boolean;
    };

export type ChatSourceListener = (event: ChatSourceEvent) => void;

export type ChatSourceWorker = {
  start(listener: ChatSourceListener): Promise<void>;
  stop(): void;
};
