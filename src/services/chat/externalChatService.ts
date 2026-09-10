import type { ChatMessage, ChatPlatform } from "./message";

type ExternalAuthor = {
  name?: string;
  id?: string;
  color?: string;
  moderator?: boolean;
  subscriber?: boolean;
  badges?: Array<{ url?: string; tooltip?: string }>;
};

type ExternalReply = {
  id?: string;
  message?: string;
  author?: ExternalAuthor;
};

type ExternalRun =
  | { text?: string }
  | { emoji?: { image?: Array<{ url?: string; width?: number; height?: number }> } };

export type ExternalChatEvent =
  | {
      type: "message";
      platform: Exclude<ChatPlatform, "twitch">;
      id?: string;
      message?: string;
      runs?: ExternalRun[];
      author?: ExternalAuthor;
      reply?: ExternalReply;
      unix?: number;
    }
  | {
      type: "delete";
      platform: Exclude<ChatPlatform, "twitch">;
      messageId?: string;
    }
  | {
      type: "ban";
      platform: Exclude<ChatPlatform, "twitch">;
      userId?: string;
    }
  | {
      type: "status";
      platform: Exclude<ChatPlatform, "twitch">;
      state: "connected" | "error";
      error?: string;
      retryable?: boolean;
    };

type ExternalChatCallbacks = {
  onMessage: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
  onBan: (userId: string) => void;
  onConnectionChange: (connected: boolean) => void;
  onError?: (error: string) => void;
};

const FALLBACK_COLORS = ["#ff0033", "#ff4d8d", "#d946ef", "#a855f7", "#f97316"] as const;

function normalizeWebSocketBase(value: string) {
  return value.trim().replace(/\/+$/, "") || "wss://ytwss.ruina.team";
}

function fallbackColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index) * (index + 1)) % 997;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function sanitizeIdentifier(value: string) {
  return value.replace(/[^\w-]/g, "");
}

function getAuthorLogin(author?: ExternalAuthor) {
  const raw = author?.name || "viewer";
  return raw.replace(/^@/, "").toLowerCase().trim() || "viewer";
}

function normalizeAuthorBadges(author?: ExternalAuthor) {
  return (author?.badges || [])
    .map((badge) => {
      const url = String(badge.url || "");
      return url ? { url, title: String(badge.tooltip || "Platform badge") } : null;
    })
    .filter((badge): badge is { url: string; title: string } => badge !== null);
}

function buildMessageFromRuns(id: string, fallbackMessage: string, runs?: ExternalRun[]) {
  const snapshot = new Map<string, any>();
  if (!Array.isArray(runs) || runs.length === 0) return { message: fallbackMessage, snapshot };

  let emojiIndex = 0;
  const message = runs.map((run) => {
    if ("text" in run && run.text) return run.text;
    if (!("emoji" in run)) return "";
    const image = run.emoji?.image?.find((candidate) => candidate.url);
    if (!image?.url) return "";
    const token = `external_emoji_${sanitizeIdentifier(id)}_${emojiIndex}`;
    emojiIndex += 1;
    snapshot.set(token, {
      id: token,
      name: token,
      url: image.url,
      source: "external",
      zero_width: false,
      width: image.width,
      height: image.height,
    });
    return token;
  }).join("").trim();

  return { message: message || fallbackMessage, snapshot };
}

export function externalEventToMessage(
  event: Extract<ExternalChatEvent, { type: "message" }>,
): ChatMessage {
  const author = event.author;
  const username = getAuthorLogin(author);
  const rawId = event.id || `${username}-${event.unix || Date.now()}`;
  const id = `${event.platform}-${sanitizeIdentifier(rawId)}`;
  const { message, snapshot } = buildMessageFromRuns(id, event.message || "", event.runs);
  const replyAuthor = event.reply?.author;
  const color = /^#[0-9a-f]{6}$/i.test(author?.color || "")
    ? author!.color!
    : fallbackColor(author?.id || username);

  return {
    id,
    username,
    displayName: (author?.name || username).replace(/^@/, ""),
    message,
    color,
    badges: [],
    emotes: {},
    userType: "",
    isModerator: Boolean(author?.moderator),
    isSubscriber: Boolean(author?.subscriber),
    timestamp: new Date(event.unix || Date.now()),
    userId: author?.id || undefined,
    platform: event.platform,
    platformBadges: normalizeAuthorBadges(author),
    emoteSnapshot: snapshot,
    reply: event.reply?.id
      ? {
          parentMsgId: event.reply.id,
          parentDisplayName: replyAuthor?.name || "",
          parentUserLogin: getAuthorLogin(replyAuthor),
          parentMsgBody: event.reply.message || "",
          parentUserId: replyAuthor?.id || "",
        }
      : undefined,
  };
}

export class ExternalChatService {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private intentionallyDisconnected = false;
  private retryable = true;

  connect(
    platform: Exclude<ChatPlatform, "twitch">,
    channel: string,
    webSocketBaseUrl: string,
    callbacks: ExternalChatCallbacks,
  ) {
    const normalizedChannel = channel.trim().replace(/^@/, "");
    if (!normalizedChannel || typeof window === "undefined") return;

    this.disconnect();
    this.intentionallyDisconnected = false;
    this.retryable = true;
    const url = `${normalizeWebSocketBase(webSocketBaseUrl)}/sources/${platform}/channels/${encodeURIComponent(normalizedChannel)}`;
    this.open(url, platform, callbacks);
  }

  disconnect() {
    this.intentionallyDisconnected = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close();
    this.socket = null;
  }

  private open(
    url: string,
    platform: Exclude<ChatPlatform, "twitch">,
    callbacks: ExternalChatCallbacks,
  ) {
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => {
      this.reconnectAttempts = 0;
      callbacks.onConnectionChange(true);
    };
    socket.onmessage = (event) => {
      let payload: ExternalChatEvent;
      try {
        payload = JSON.parse(String(event.data)) as ExternalChatEvent;
      } catch {
        return;
      }
      if (payload.platform !== platform) return;
      if (payload.type === "message") callbacks.onMessage(externalEventToMessage(payload));
      if (payload.type === "delete" && payload.messageId) {
        callbacks.onDelete(`${platform}-${sanitizeIdentifier(payload.messageId)}`);
      }
      if (payload.type === "ban" && payload.userId) callbacks.onBan(payload.userId);
      if (payload.type === "status" && payload.state === "error") {
        this.retryable = payload.retryable !== false;
        callbacks.onError?.(payload.error || `${platform} source error`);
      }
    };
    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      callbacks.onConnectionChange(false);
      if (!this.intentionallyDisconnected && this.retryable && event.code !== 1000) {
        this.scheduleReconnect(url, platform, callbacks);
      }
    };
    socket.onerror = () => socket.close();
  }

  private scheduleReconnect(
    url: string,
    platform: Exclude<ChatPlatform, "twitch">,
    callbacks: ExternalChatCallbacks,
  ) {
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionallyDisconnected) this.open(url, platform, callbacks);
    }, delay);
  }
}
