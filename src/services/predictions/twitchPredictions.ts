export type TwitchPredictionStatus =
  | "ACTIVE"
  | "LOCKED"
  | "RESOLVED"
  | "CANCELED"
  | "UNKNOWN";

export type TwitchPredictionOutcome = {
  id: string;
  title: string;
  color: string;
  totalPoints: number;
  totalUsers: number;
  badgeUrl: string;
  isWinner: boolean;
};

export type TwitchPredictionEvent = {
  id: string;
  title: string;
  status: TwitchPredictionStatus;
  createdAt: string;
  lockedAt: string | null;
  endedAt: string | null;
  predictionWindowSeconds: number;
  winningOutcomeId: string | null;
  outcomes: TwitchPredictionOutcome[];
  updatedAt: number;
  source: "gql" | "hermes";
};

export type TwitchPredictionsConnectionState =
  | "idle"
  | "resolving"
  | "connecting"
  | "connected"
  | "polling"
  | "error";

export type TwitchPredictionsClientOptions = {
  channelLogin: string;
  onPrediction: (event: TwitchPredictionEvent | null) => void;
  onStateChange?: (state: TwitchPredictionsConnectionState) => void;
  onError?: (error: Error) => void;
};

export type TwitchPredictionsClient = {
  start: () => void;
  stop: () => void;
  refresh: () => Promise<void>;
};

const TWITCH_GQL_ENDPOINT = "https://gql.twitch.tv/gql#origin=twilight";
const TWITCH_HERMES_ENDPOINT = "wss://hermes.twitch.tv/v1";
const TWITCH_WEB_CLIENT_ID =
  import.meta.env.VITE_TWITCH_GQL_CLIENT_ID || "kimne78kx3ncx6brgo4mv6wki5h1ko";
const TWITCH_CLIENT_VERSION =
  import.meta.env.VITE_TWITCH_CLIENT_VERSION ||
  "b140f146-2632-41e8-a374-5b41520ac27e";
const GET_ID_FROM_LOGIN_HASH =
  "94e82a7b1e3c21e186daa73ee2afc4b8f23bade1fbbff6fe8ac133f50a2f58ca";
const CHANNEL_POINTS_PREDICTION_CONTEXT_HASH =
  "beb846598256b75bd7c1fe54a80431335996153e358ca9c7837ce7bb83d7d383";
const ACTIVE_POLL_MS = 2_000;
const IDLE_POLL_MS = 12_000;
const RESOLVED_VISIBLE_MS = 15_000;

function normalizeLogin(value: string): string {
  return value.trim().replace(/^#|^@/, "").toLowerCase();
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

function compactDeviceId(): string {
  return randomId().replaceAll("-", "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function fetchTwitchGql(payload: unknown): Promise<unknown> {
  const response = await fetch(TWITCH_GQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Client-ID": TWITCH_WEB_CLIENT_ID,
      "Client-Version": TWITCH_CLIENT_VERSION,
      "Client-Session-Id": compactDeviceId().slice(0, 16),
      "X-Device-Id": compactDeviceId(),
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Twitch GQL HTTP ${response.status}`);
  }

  return data;
}

async function resolveChannelId(channelLogin: string): Promise<string> {
  const payload = [
    {
      operationName: "GetIDFromLogin",
      variables: { login: channelLogin },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: GET_ID_FROM_LOGIN_HASH,
        },
      },
    },
  ];
  const data = await fetchTwitchGql(payload);
  const item = asRecord(asArray(data)[0]);
  const user = asRecord(asRecord(item?.data)?.user);
  const id = asString(user?.id);
  if (!id) throw new Error(`Twitch channel not found: ${channelLogin}`);
  return id;
}

async function fetchPredictionSnapshot(
  channelLogin: string,
): Promise<TwitchPredictionEvent | null> {
  const payload = [
    {
      operationName: "ChannelPointsPredictionContext",
      variables: { count: 1, channelLogin },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: CHANNEL_POINTS_PREDICTION_CONTEXT_HASH,
        },
      },
    },
  ];
  const data = await fetchTwitchGql(payload);
  const item = asRecord(asArray(data)[0]);
  const channel = asRecord(asRecord(asRecord(item?.data)?.community)?.channel);
  const rawEvent =
    asArray(channel?.activePredictionEvents)[0] ||
    asArray(channel?.lockedPredictionEvents)[0] ||
    asRecord(asArray(asRecord(channel?.resolvedPredictionEvents)?.edges)[0])?.node;

  const event = normalizePredictionEvent(rawEvent, "gql");
  if (!event) return null;
  if (event.status !== "RESOLVED") return event;
  if (!event.endedAt) return null;

  const endedAt = Date.parse(event.endedAt);
  return Number.isFinite(endedAt) && Date.now() - endedAt <= RESOLVED_VISIBLE_MS
    ? event
    : null;
}

function normalizePredictionEvent(
  raw: unknown,
  source: "gql" | "hermes",
): TwitchPredictionEvent | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = asString(record.id);
  const outcomes = asArray(record.outcomes)
    .map((outcome) => normalizeOutcome(outcome, record))
    .filter((outcome): outcome is TwitchPredictionOutcome => Boolean(outcome));

  if (!id || outcomes.length === 0) return null;

  return {
    id,
    title: asString(record.title) || "Prediction",
    status: normalizeStatus(record.status),
    createdAt: asString(record.createdAt ?? record.created_at),
    lockedAt: asNullableString(record.lockedAt ?? record.locked_at),
    endedAt: asNullableString(record.endedAt ?? record.ended_at),
    predictionWindowSeconds: asNumber(
      record.predictionWindowSeconds ?? record.prediction_window_seconds,
    ),
    winningOutcomeId: asNullableString(
      asRecord(record.winningOutcome)?.id ?? record.winning_outcome_id,
    ),
    outcomes,
    updatedAt: Date.now(),
    source,
  };
}

function normalizeOutcome(
  raw: unknown,
  eventRecord: Record<string, unknown>,
): TwitchPredictionOutcome | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = asString(record.id);
  if (!id) return null;

  const winningOutcomeId = asString(
    asRecord(eventRecord.winningOutcome)?.id ?? eventRecord.winning_outcome_id,
  );
  const badge = asRecord(record.badge);

  return {
    id,
    title: asString(record.title) || "Outcome",
    color: asString(record.color) || "BLUE",
    totalPoints: asNumber(record.totalPoints ?? record.total_points),
    totalUsers: asNumber(record.totalUsers ?? record.total_users),
    badgeUrl: asString(badge?.image4x ?? badge?.image2x ?? badge?.image1x),
    isWinner: Boolean(winningOutcomeId && winningOutcomeId === id),
  };
}

function normalizeStatus(value: unknown): TwitchPredictionStatus {
  const status = asString(value).toUpperCase();
  if (
    status === "ACTIVE" ||
    status === "LOCKED" ||
    status === "RESOLVED" ||
    status === "CANCELED"
  ) {
    return status;
  }

  return "UNKNOWN";
}

function asNullableString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function extractHermesPredictionEvent(payload: unknown): TwitchPredictionEvent | null {
  const record = asRecord(payload);
  if (!record) return null;

  const directMessage =
    asRecord(record.data)?.message ??
    asRecord(record.notification)?.message ??
    record.message;
  const pubSubMessage =
    typeof directMessage === "string" ? parseJson(directMessage) : directMessage;
  const messageRecord = asRecord(pubSubMessage);
  const event =
    asRecord(messageRecord?.data)?.event ??
    asRecord(messageRecord?.data)?.prediction ??
    messageRecord?.event;

  return normalizePredictionEvent(event, "hermes");
}

export function createTwitchPredictionsClient(
  options: TwitchPredictionsClientOptions,
): TwitchPredictionsClient {
  const channelLogin = normalizeLogin(options.channelLogin);
  let channelId = "";
  let socket: WebSocket | null = null;
  let pollTimer = 0;
  let stopped = false;

  const setState = (state: TwitchPredictionsConnectionState) => {
    options.onStateChange?.(state);
  };

  const reportError = (error: unknown) => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    options.onError?.(normalized);
  };

  const clearPoll = () => {
    if (pollTimer) {
      window.clearTimeout(pollTimer);
      pollTimer = 0;
    }
  };

  const schedulePoll = (event: TwitchPredictionEvent | null) => {
    clearPoll();
    if (stopped) return;

    const delay = event ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    pollTimer = window.setTimeout(() => {
      void refresh();
    }, delay);
  };

  const emitPrediction = (event: TwitchPredictionEvent | null) => {
    options.onPrediction(event);
    schedulePoll(event);
  };

  const refresh = async () => {
    if (!channelLogin || stopped) return;
    try {
      setState(socket?.readyState === WebSocket.OPEN ? "connected" : "polling");
      const event = await fetchPredictionSnapshot(channelLogin);
      if (!stopped) emitPrediction(event);
    } catch (error) {
      reportError(error);
      schedulePoll(null);
    }
  };

  const subscribeHermes = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN || !channelId) return;

    const messageId = randomId();
    socket.send(
      JSON.stringify({
        type: "subscribe",
        id: messageId,
        subscribe: {
          id: randomId(),
          type: "pubsub",
          pubsub: {
            topic: `predictions-channel-v1.${channelId}`,
          },
        },
        timestamp: new Date().toISOString(),
      }),
    );
  };

  const connectHermes = () => {
    if (!channelId || stopped) return;

    setState("connecting");
    socket?.close();
    socket = new WebSocket(`${TWITCH_HERMES_ENDPOINT}?clientId=${TWITCH_WEB_CLIENT_ID}`);

    socket.addEventListener("message", (event) => {
      const raw = typeof event.data === "string" ? event.data : String(event.data);
      const payload = parseJson(raw);
      const record = asRecord(payload);
      const type = asString(record?.type);

      if (type === "welcome") {
        subscribeHermes();
        return;
      }

      if (type === "subscribeResponse") {
        setState("connected");
        return;
      }

      if (type === "keepalive") return;

      const prediction = extractHermesPredictionEvent(payload);
      if (prediction) {
        emitPrediction(prediction);
      }

      void refresh();
    });

    socket.addEventListener("error", () => {
      setState("error");
      reportError(new Error("Twitch Hermes WebSocket error"));
    });

    socket.addEventListener("close", () => {
      if (stopped) return;
      setState("polling");
      window.setTimeout(connectHermes, 5_000);
    });
  };

  const start = () => {
    if (!channelLogin || stopped) return;
    void (async () => {
      setState("resolving");
      channelId = await resolveChannelId(channelLogin);
      if (stopped) return;

      connectHermes();
      await refresh();
    })().catch((error) => {
      reportError(error);
      setState("error");
      schedulePoll(null);
    });
  };

  const stop = () => {
    stopped = true;
    clearPoll();
    socket?.close();
    socket = null;
  };

  return {
    start,
    stop,
    refresh,
  };
}
