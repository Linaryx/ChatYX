import type { ServerWebSocket } from "bun";
import { connectLiveChat, type LiveChatSession } from "./live-chat";
import { SourceRegistry } from "./source-registry";
import type { ChatSourcePlatform } from "./source-events";
import { KickSourceWorker } from "./sources/kick";
import { YouTubeSourceWorker } from "./sources/youtube";
import { getYouTubeProxyUrl, resolveLiveVideoIds } from "./youtube";
import { searchKickChannels } from "./kickSearch";
import { resolveWebSocketRoute, type SourceRoute, type WebSocketRoute } from "./routes";
import {
  resolveBridgeLimits,
  resolveClientIp,
  SourceGuard,
  type GuardDecision,
  type SocketAdmission,
} from "./guard";

type WebSocketData = WebSocketRoute & {
  readonly clientIp: string;
  /** Aborted when the socket closes, so pending upstream work is released. */
  readonly abort: AbortController;
};

const port = Number(process.env.PORT || 9905);
const hostname = process.env.HOST || "0.0.0.0";
const limits = resolveBridgeLimits();
const guard = new SourceGuard(limits);
const sourceRegistry = new SourceRegistry({
  maxSources: limits.maxSources,
  maxClientsPerSource: limits.maxClientsPerSource,
});

const legacySessions = new WeakMap<ServerWebSocket<WebSocketData>, LiveChatSession[]>();
const sourceUnsubscribers = new WeakMap<ServerWebSocket<WebSocketData>, () => void>();

/** Sources are receive-only, so clients have no reason to send more than this. */
const MAX_PAYLOAD_BYTES = 4 * 1024;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;
const BACKPRESSURE_LIMIT_BYTES = 1024 * 1024;
const RATE_LIMIT_PRUNE_MS = 5 * 60_000;

function responseHeaders(
  origin: string | null,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "access-control-allow-origin": origin || "*",
    ...(origin ? { vary: "origin" } : {}),
    ...extra,
  };
}

function jsonResponse(payload: unknown, status = 200, origin: string | null = null) {
  return Response.json(payload, { status, headers: responseHeaders(origin) });
}

function rejectionResponse(decision: GuardDecision, origin: string | null) {
  return Response.json(
    { error: { code: decision.code, message: decision.message } },
    {
      status: decision.status,
      headers: responseHeaders(
        origin,
        decision.retryAfterSeconds > 0
          ? { "retry-after": String(decision.retryAfterSeconds) }
          : {},
      ),
    },
  );
}

function send(ws: ServerWebSocket<WebSocketData>, event: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
}

async function openLegacyYouTubeChat(ws: ServerWebSocket<WebSocketData>) {
  if (ws.data.kind !== "legacy") return;
  const videoIds = ws.data.mode === "channel"
    ? await resolveLiveVideoIds(ws.data.id)
    : [ws.data.id];
  // The socket may already be gone: the lookup above can take a while.
  if (ws.data.abort.signal.aborted) return;

  let activeStreams = videoIds.length;
  const activeSessions: LiveChatSession[] = [];
  legacySessions.set(ws, activeSessions);

  for (const videoId of videoIds) {
    const session = await connectLiveChat(
      videoId,
      (event) => send(ws, event),
      (reason) => ws.close(1000, reason),
      () => {
        activeStreams -= 1;
        if (activeStreams <= 0) ws.close(1000, "All live chats have ended");
      },
    );
    if (ws.data.abort.signal.aborted) {
      session.stop();
      return;
    }
    activeSessions.push(session);
  }

  send(ws, {
    info: "connected",
    mode: ws.data.mode,
    id: ws.data.id,
    videoIds,
  });
}

function sourceKey(route: SourceRoute) {
  return route.platform === "youtube"
    ? `youtube:${route.mode}:${route.id.toLowerCase()}`
    : `kick:${route.id.toLowerCase()}`;
}

function sourcePlatform(route: SourceRoute): ChatSourcePlatform {
  return route.platform;
}

async function openSource(ws: ServerWebSocket<WebSocketData>) {
  if (ws.data.kind !== "source") return;
  const { route } = ws.data;
  let unsubscribe: () => void;
  try {
    unsubscribe = await sourceRegistry.subscribe(
      sourceKey(route),
      () => route.platform === "youtube"
        ? new YouTubeSourceWorker(route.mode, route.id)
        : new KickSourceWorker(route.id),
      (event) => send(ws, event),
      { signal: ws.data.abort.signal },
    );
  } catch (error) {
    // The socket was closed while the source was starting; the registry has
    // already released it, so there is nobody left to report to.
    if (error instanceof DOMException && error.name === "AbortError") return;
    const reason = error instanceof Error ? error.message : "Source is unavailable";
    send(ws, {
      type: "status",
      platform: sourcePlatform(route),
      state: "error",
      error: reason,
      retryable: true,
    });
    ws.close(1013, reason);
    return;
  }
  sourceUnsubscribers.set(ws, unsubscribe);
}

function stopLegacySessions(ws: ServerWebSocket<WebSocketData>) {
  const activeSessions = legacySessions.get(ws);
  if (!activeSessions) return;
  for (const session of activeSessions) session.stop();
  legacySessions.delete(ws);
}

/** What this socket will consume once it is open, checked before the upgrade. */
function admissionFor(route: WebSocketRoute): SocketAdmission {
  if (route.kind === "legacy") return { kind: "legacy" };
  const key = sourceKey(route.route);
  return {
    kind: "source",
    isNewWorker: !sourceRegistry.has(key),
    capacityIssue: sourceRegistry.capacityIssue(key),
  };
}

const server = Bun.serve<WebSocketData>({
  port,
  hostname,
  maxRequestBodySize: MAX_REQUEST_BODY_BYTES,
  fetch(request, serverInstance) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const originDecision = guard.checkOrigin(origin);
    if (!originDecision.allowed) return rejectionResponse(originDecision, origin);

    if (url.pathname === "/health") {
      return jsonResponse(
        {
          service: "ChatYX chat sources",
          status: "ok",
          active: {
            connections: guard.activeConnections,
            sources: sourceRegistry.sourceCount,
            clients: sourceRegistry.clientCount,
          },
        },
        200,
        origin,
      );
    }
    if (url.pathname === "/api/kick/channels") {
      const clientAddress = serverInstance.requestIP(request)?.address;
      const searchDecision = guard.checkSearch(
        resolveClientIp(request.headers, clientAddress, limits.trustProxy),
      );
      if (!searchDecision.allowed) return rejectionResponse(searchDecision, origin);
      return searchKickChannels(url.searchParams.get("query") || "")
        .then((channels) => jsonResponse({ channels }, 200, origin))
        .catch(() =>
          jsonResponse(
            { error: { code: "KICK_SEARCH_UNAVAILABLE", message: "Kick search is unavailable" } },
            502,
            origin,
          ),
        );
    }

    const resolved = resolveWebSocketRoute(url.pathname, {
      maxChannelNameLength: limits.maxChannelNameLength,
    });
    if (!resolved.matched) {
      if (resolved.reason === "invalid_id") {
        return jsonResponse(
          {
            error: {
              code: "INVALID_SOURCE_ID",
              message: "Channel identifier is malformed or longer than the bridge accepts",
            },
          },
          400,
          origin,
        );
      }
      return jsonResponse(
        {
          service: "ChatYX chat sources",
          endpoints: [
            "/sources/youtube/channels/<handle-or-channel-id>",
            "/sources/kick/channels/<channel-slug>",
            "/health",
          ],
        },
        404,
        origin,
      );
    }

    const { route } = resolved;
    const ip = resolveClientIp(
      request.headers,
      serverInstance.requestIP(request)?.address,
      limits.trustProxy,
    );
    const upgradeDecision = guard.checkUpgrade(ip);
    if (!upgradeDecision.allowed) return rejectionResponse(upgradeDecision, origin);

    const decision = guard.admit(ip, admissionFor(route));
    if (!decision.allowed) return rejectionResponse(decision, origin);

    if (serverInstance.upgrade(request, { data: { ...route, clientIp: ip, abort: new AbortController() } })) {
      return undefined;
    }
    guard.release(ip, route.kind);
    return jsonResponse({ error: "WebSocket upgrade failed" }, 400, origin);
  },
  websocket: {
    // Bun pings idle sockets and closes the ones that stop answering, which
    // drops dead OBS browser sources without touching quiet live chats.
    idleTimeout: limits.idleTimeoutSeconds,
    sendPings: true,
    maxPayloadLength: MAX_PAYLOAD_BYTES,
    backpressureLimit: BACKPRESSURE_LIMIT_BYTES,
    closeOnBackpressureLimit: true,
    open(ws) {
      const operation = ws.data.kind === "legacy" ? openLegacyYouTubeChat(ws) : openSource(ws);
      void operation.catch((error) => {
        const reason = error instanceof Error ? error.message : "Internal error";
        const platform = ws.data.kind === "source" ? sourcePlatform(ws.data.route) : "youtube";
        console.error(`[chat-sources] Failed to open ${platform} source`, error);
        if (ws.data.kind === "source") {
          send(ws, { type: "status", platform, state: "error", error: reason, retryable: true });
        }
        ws.close(1011, reason);
      });
    },
    message() {
      // Sources are receive-only.
    },
    close(ws) {
      stopLegacySessions(ws);
      ws.data.abort.abort();
      sourceUnsubscribers.get(ws)?.();
      sourceUnsubscribers.delete(ws);
      guard.release(ws.data.clientIp, ws.data.kind);
    },
  },
});

setInterval(() => guard.prune(), RATE_LIMIT_PRUNE_MS);

console.log(`[chat-sources] listening on ws://${server.hostname}:${server.port}`);
console.log(`[chat-sources] youtube proxy: ${getYouTubeProxyUrl() || "disabled"}`);
console.log(
  `[chat-sources] limits: ${JSON.stringify({
    connectionsPerIp: limits.maxConnectionsPerIp,
    sourcesPerIp: limits.maxSourcesPerIp,
    connections: limits.maxConnections,
    legacyConnections: limits.maxLegacyConnections,
    sources: limits.maxSources,
    clientsPerSource: limits.maxClientsPerSource,
    channelNameLength: limits.maxChannelNameLength,
    idleTimeoutSeconds: limits.idleTimeoutSeconds,
    trustProxy: limits.trustProxy,
    allowedOrigins: limits.allowedOrigins.length > 0 ? limits.allowedOrigins : "*",
  })}`,
);
