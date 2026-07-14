import type { TwitchMessage } from "./twitchService";

type YouTubeAuthor = {
  name?: string;
  id?: string;
  moderator?: boolean;
  badges?: Array<{
    url?: string;
    tooltip?: string;
  }>;
};

type YouTubeRun =
  | { text?: string }
  | { emoji?: { image?: Array<{ url?: string; width?: number; height?: number }> } };

type YouTubeChatEvent =
  | {
      type: "message";
      id?: string;
      message?: string;
      runs?: YouTubeRun[];
      author?: YouTubeAuthor;
      unix?: number;
    }
  | {
      type: "superchat";
      id?: string;
      purchase_amount?: string;
      hasMessage?: boolean;
      message?: string;
      runs?: YouTubeRun[];
      author?: YouTubeAuthor;
      unix?: number;
    }
  | { info: "deleted"; message?: string }
  | { info: "banned"; externalChannelId?: string }
  | { info: string };

type YouTubeChatCallbacks = {
  onMessage: (message: TwitchMessage) => void;
  onDelete: (messageId: string) => void;
  onBan: (userId: string) => void;
  onConnectionChange: (connected: boolean) => void;
};

const FALLBACK_COLORS = [
  "#ff0033",
  "#ff4d8d",
  "#d946ef",
  "#a855f7",
  "#f97316",
] as const;

function normalizeHandle(value: string) {
  return value.trim().replace(/^@/, "");
}

function normalizeWebSocketBase(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (trimmed) return trimmed;
  return "wss://ytwss.ruina.team";
}

function fallbackColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index) * (index + 1)) % 997;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function sanitizeMessageId(value: string) {
  return value.replace(/[^\w-]/g, "");
}

function getAuthorLogin(author?: YouTubeAuthor) {
  const raw = author?.name || "youtube";
  return raw.replace(/^@/, "").toLowerCase().trim() || "youtube";
}

function normalizeAuthorBadges(author?: YouTubeAuthor) {
  return (author?.badges || [])
    .map((badge) => {
      const url = String(badge.url || "");
      if (!url) return null;

      return {
        url,
        title: String(badge.tooltip || "YouTube badge"),
      };
    })
    .filter((badge): badge is { url: string; title: string } => badge !== null);
}

function buildMessageFromRuns(
  eventId: string,
  fallbackMessage: string,
  runs?: YouTubeRun[],
) {
  const snapshot = new Map<string, any>();

  if (!Array.isArray(runs) || runs.length === 0) {
    return { message: fallbackMessage, snapshot };
  }

  let emojiIndex = 0;
  const parts = runs.map((run) => {
    if ("text" in run && run.text) return run.text;

    if ("emoji" in run) {
      const image = run.emoji?.image?.find((image) => image.url);
      const url = image?.url || "";
      if (!url) return "";

      const token = `yt_emoji_${sanitizeMessageId(eventId)}_${emojiIndex}`;
      emojiIndex += 1;
      snapshot.set(token, {
        id: token,
        name: token,
        url,
        source: "youtube",
        zero_width: false,
        width: image?.width,
        height: image?.height,
      });
      return token;
    }

    return "";
  });

  const message = parts.join("").trim() || fallbackMessage;
  return { message, snapshot };
}

function eventToMessage(event: Extract<YouTubeChatEvent, { type: string }>) {
  const author = event.author;
  const username = getAuthorLogin(author);
  const rawId = event.id || `${username}-${event.unix || Date.now()}`;
  const id = `youtube-${sanitizeMessageId(rawId)}`;
  const baseText =
    event.type === "superchat"
      ? [event.purchase_amount, event.hasMessage ? event.message : ""]
          .filter(Boolean)
          .join(" ")
      : event.message || "";
  const { message, snapshot } = buildMessageFromRuns(
    id,
    baseText,
    event.runs,
  );

  return {
    id,
    username,
    displayName: (author?.name || username).replace(/^@/, ""),
    message,
    color: fallbackColor(author?.id || username),
    badges: [],
    emotes: {},
    userType: "",
    isModerator: Boolean(author?.moderator),
    isSubscriber: false,
    timestamp: new Date(event.unix || Date.now()),
    userId: author?.id || undefined,
    platform: "youtube" as const,
    platformBadges: normalizeAuthorBadges(author),
    emoteSnapshot: snapshot,
  } satisfies TwitchMessage;
}

export class YouTubeChatService {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private intentionallyDisconnected = false;

  connect(
    channel: string,
    wsBaseUrl: string,
    callbacks: YouTubeChatCallbacks,
  ) {
    const normalizedChannel = normalizeHandle(channel);
    if (!normalizedChannel || typeof window === "undefined") return;

    this.disconnect();
    this.intentionallyDisconnected = false;

    const baseUrl = normalizeWebSocketBase(wsBaseUrl);
    const url = `${baseUrl}/c/${encodeURIComponent(normalizedChannel)}`;
    this.open(url, callbacks);
  }

  disconnect() {
    this.intentionallyDisconnected = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private open(url: string, callbacks: YouTubeChatCallbacks) {
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      callbacks.onConnectionChange(true);
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(String(event.data)) as YouTubeChatEvent;

      if ("info" in payload) {
        if (
          payload.info === "deleted" &&
          "message" in payload &&
          payload.message
        ) {
          callbacks.onDelete(`youtube-${sanitizeMessageId(payload.message)}`);
        } else if (
          payload.info === "banned" &&
          "externalChannelId" in payload &&
          payload.externalChannelId
        ) {
          callbacks.onBan(payload.externalChannelId);
        }
        return;
      }

      if (payload.type === "message" || payload.type === "superchat") {
        callbacks.onMessage(eventToMessage(payload));
      }
    };

    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      callbacks.onConnectionChange(false);
      if (!this.intentionallyDisconnected && this.shouldReconnect(event)) {
        this.scheduleReconnect(url, callbacks);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  private scheduleReconnect(url: string, callbacks: YouTubeChatCallbacks) {
    if (this.reconnectTimer !== null) return;

    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.intentionallyDisconnected) {
        this.open(url, callbacks);
      }
    }, delay);
  }

  private shouldReconnect(event: CloseEvent) {
    if (event.code === 1000) return false;

    const reason = event.reason.toLowerCase();
    if (reason.includes("could not find a live stream")) return false;
    if (reason.includes("no available live chat")) return false;

    return true;
  }
}
