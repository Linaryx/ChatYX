import type {
  ChatSourceAuthor,
  ChatSourceEvent,
  ChatSourceListener,
  ChatSourceWorker,
} from "../source-events";

const KICK_CHANNEL_ENDPOINT = "https://kick.com/api/v2/channels";
const KICK_REALTIME_ENDPOINT = "https://web.kick.com/api/v1/realtime";
const KICK_CHAT_EVENT = "App\\Events\\ChatMessageEvent";
const MAX_RECONNECT_DELAY_MS = 30_000;
const GUEST_TOKEN_REFRESH_MARGIN_SECONDS = 60;

type KickBadge = {
  type?: unknown;
  text?: unknown;
};

type KickBadgeV2 = {
  image_url?: unknown;
  name?: unknown;
  selected?: unknown;
};

type KickIdentity = {
  color?: unknown;
  badges?: KickBadge[];
  badges_v2?: KickBadgeV2[];
};

type KickSender = {
  id?: unknown;
  username?: unknown;
  identity?: KickIdentity | null;
};

type KickMessage = {
  id?: unknown;
  content?: unknown;
  type?: unknown;
  created_at?: unknown;
  sender?: KickSender;
  metadata?: unknown;
};

type KickChannel = {
  channelId: string;
  chatroomId: string;
};

type KickRealtimeCredentials = {
  url: string;
  token: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asId(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function isSafeHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isSafeWebSocketUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "wss:";
  } catch {
    return false;
  }
}

function normalizeSender(sender: KickSender | undefined): ChatSourceAuthor {
  const identity = sender?.identity && typeof sender.identity === "object"
    ? sender.identity
    : undefined;
  const badgeTypes = new Set(
    (Array.isArray(identity?.badges) ? identity.badges : [])
      .map((badge) => asString(badge.type).toLowerCase())
      .filter(Boolean),
  );
  const color = asString(identity?.color);
  const badges = (Array.isArray(identity?.badges_v2) ? identity.badges_v2 : [])
    .filter((badge) => badge.selected !== false && isSafeHttpsUrl(badge.image_url))
    .map((badge) => ({
      url: asString(badge.image_url),
      tooltip: asString(badge.name) || "Kick badge",
    }));

  return {
    name: asString(sender?.username) || "Kick viewer",
    id: asId(sender?.id) || undefined,
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : undefined,
    moderator: badgeTypes.has("moderator"),
    subscriber: badgeTypes.has("subscriber"),
    badges,
  };
}

function displayKickContent(value: unknown) {
  return asString(value).replace(/\[emote:[^:\]]+:([^\]]+)\]/g, "$1");
}

function parseReply(metadata: unknown) {
  const raw = asString(metadata);
  if (!raw) return undefined;
  try {
    const value = asRecord(JSON.parse(raw));
    const original = asRecord(value.original_message);
    const sender = asRecord(value.original_sender);
    const id = asString(original.id);
    if (!id) return undefined;
    return {
      id,
      message: displayKickContent(original.content),
      author: normalizeSender(sender as KickSender),
    };
  } catch {
    return undefined;
  }
}

export function normalizeKickMessage(value: unknown): ChatSourceEvent | null {
  const message = value as KickMessage;
  const id = asString(message.id);
  const author = normalizeSender(message.sender);
  if (!id || !author.name) return null;
  const reply = message.type === "reply" ? parseReply(message.metadata) : undefined;
  return {
    type: "message",
    platform: "kick",
    id,
    message: displayKickContent(message.content),
    author,
    ...(reply ? { reply } : {}),
    unix: Date.parse(asString(message.created_at)) || Date.now(),
  };
}

export function normalizeKickRealtimeMessage(value: unknown): ChatSourceEvent | null {
  const envelope = asRecord(value);
  const publication = asRecord(asRecord(asRecord(envelope.push).pub).data);
  if (asString(publication.event) !== KICK_CHAT_EVENT) return null;
  const rawMessage = publication.data;
  try {
    return normalizeKickMessage(
      typeof rawMessage === "string" ? JSON.parse(rawMessage) : rawMessage,
    );
  } catch {
    return null;
  }
}

async function fetchKickJson(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-app-platform": "web",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Kick request failed (${response.status})`);
  return asRecord(await response.json());
}

function getRealtimeUrl(value: Record<string, unknown>): string {
  const data = asRecord(value.data);
  const connections = Array.isArray(data.connections) ? data.connections : [];
  for (const connection of connections) {
    const url = asRecord(asRecord(connection).credentials).url;
    if (isSafeWebSocketUrl(url)) return url;
  }
  return "";
}

async function resolveKickChannel(slug: string): Promise<KickChannel> {
  const response = await fetch(`${KICK_CHANNEL_ENDPOINT}/${encodeURIComponent(slug)}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Kick channel lookup failed (${response.status})`);
  const data = asRecord(await response.json());
  const channelId = asId(data.id);
  const chatroomId = asId(asRecord(data.chatroom).id);
  if (!channelId || !chatroomId) throw new Error(`Kick chatroom not found: ${slug}`);
  return { channelId, chatroomId };
}

async function resolveRealtimeCredentials(channelId: string): Promise<KickRealtimeCredentials> {
  const clientId = crypto.randomUUID();
  const connectionRequest = {
    client: { id: clientId, type: "web" },
    capabilities: { accepted_providers: [{ provider: "pusher" }, { provider: "centrifugo" }] },
  };
  const [connection, channelConnection, auth] = await Promise.all([
    fetchKickJson(`${KICK_REALTIME_ENDPOINT}/connection`, connectionRequest),
    fetchKickJson(
      `${KICK_REALTIME_ENDPOINT}/channels/${encodeURIComponent(channelId)}/chat/connection`,
      connectionRequest,
    ),
    fetchKickJson(`${KICK_REALTIME_ENDPOINT}/auth/connection`, { client_id: clientId }),
  ]);
  const token = asString(asRecord(auth.data).token);
  const url = getRealtimeUrl(channelConnection) || getRealtimeUrl(connection);
  if (!token || !url) throw new Error("Kick realtime credentials unavailable");
  return { url, token };
}

export class KickSourceWorker implements ChatSourceWorker {
  private socket: WebSocket | null = null;
  private listener: ChatSourceListener | null = null;
  private channelId = "";
  private chatroomId = "";
  private stopped = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private credentialRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;

  constructor(private readonly slug: string) {}

  async start(listener: ChatSourceListener) {
    this.listener = listener;
    this.stopped = false;
    const channel = await resolveKickChannel(this.slug);
    this.channelId = channel.channelId;
    this.chatroomId = channel.chatroomId;
    await this.open(true);
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.credentialRefreshTimer) clearTimeout(this.credentialRefreshTimer);
    this.credentialRefreshTimer = null;
    this.socket?.close(1000, "No active ChatYX clients");
    this.socket = null;
    this.listener = null;
  }

  private async open(initial = false): Promise<void> {
    if (this.stopped || !this.listener) return;
    try {
      const credentials = await resolveRealtimeCredentials(this.channelId);
      if (this.stopped || !this.listener) return;

      const socket = new WebSocket(credentials.url);
      this.socket = socket;
      socket.onopen = () => {
        socket.send([
          JSON.stringify({ connect: { token: credentials.token, name: "js" }, id: 1 }),
          JSON.stringify({
            subscribe: { channel: `chatrooms.${this.chatroomId}.v2`, flag: 1 },
            id: 2,
          }),
        ].join("\n"));
      };
      socket.onmessage = (event) => this.handleCentrifugoMessage(socket, String(event.data));
      socket.onclose = () => {
        if (this.socket !== socket || this.stopped) return;
        if (this.credentialRefreshTimer) clearTimeout(this.credentialRefreshTimer);
        this.credentialRefreshTimer = null;
        this.listener?.({
          type: "status",
          platform: "kick",
          state: "error",
          error: "Kick realtime connection closed",
          retryable: true,
        });
        this.scheduleReconnect();
      };
      socket.onerror = () => socket.close();
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Kick realtime connection failed";
      this.listener?.({
        type: "status",
        platform: "kick",
        state: "error",
        error: reason,
        retryable: true,
      });
      if (initial) throw error;
      this.scheduleReconnect();
    }
  }

  private handleCentrifugoMessage(socket: WebSocket, raw: string) {
    for (const entry of raw.split("\n")) {
      let frame: Record<string, unknown>;
      try {
        frame = asRecord(JSON.parse(entry));
      } catch {
        continue;
      }

      if (Object.keys(frame).length === 0) {
        socket.send("{}");
        continue;
      }

      const message = normalizeKickRealtimeMessage(frame);
      if (message) {
        this.listener?.(message);
        continue;
      }

      if (Number(frame.id) === 1) {
        const ttl = Number(asRecord(frame.connect).ttl);
        if (Number.isFinite(ttl) && ttl > GUEST_TOKEN_REFRESH_MARGIN_SECONDS) {
          this.scheduleCredentialRefresh(socket, ttl);
        }
      }

      if (Number(frame.id) === 2 && "subscribe" in frame) {
        this.reconnectAttempt = 0;
        this.listener?.({ type: "status", platform: "kick", state: "connected" });
      }
    }
  }

  private scheduleCredentialRefresh(socket: WebSocket, ttlSeconds: number) {
    if (this.credentialRefreshTimer) clearTimeout(this.credentialRefreshTimer);
    const delay = Math.max(
      1000,
      (ttlSeconds - GUEST_TOKEN_REFRESH_MARGIN_SECONDS) * 1000,
    );
    this.credentialRefreshTimer = setTimeout(() => {
      this.credentialRefreshTimer = null;
      if (this.socket === socket) socket.close(1000, "Refreshing Kick guest credentials");
    }, delay);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.stopped) return;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.open();
    }, delay);
  }
}
