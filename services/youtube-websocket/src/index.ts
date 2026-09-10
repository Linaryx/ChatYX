import type { ServerWebSocket } from "bun";
import { connectLiveChat, type LiveChatSession } from "./live-chat";
import { SourceRegistry } from "./source-registry";
import type { ChatSourcePlatform } from "./source-events";
import { KickSourceWorker } from "./sources/kick";
import { YouTubeSourceWorker, isYouTubeSourceId, type YouTubeSourceMode } from "./sources/youtube";
import { getYouTubeProxyUrl, isVideoId, resolveLiveVideoIds } from "./youtube";

type LegacyWebSocketData = {
  kind: "legacy";
  mode: YouTubeSourceMode;
  id: string;
};

type SourceRoute =
  | { platform: "youtube"; mode: YouTubeSourceMode; id: string }
  | { platform: "kick"; id: string };

type SourceWebSocketData = {
  kind: "source";
  route: SourceRoute;
};

type WebSocketData = LegacyWebSocketData | SourceWebSocketData;

const port = Number(process.env.PORT || 9905);
const hostname = process.env.HOST || "0.0.0.0";
const legacySessions = new WeakMap<ServerWebSocket<WebSocketData>, LiveChatSession[]>();
const sourceUnsubscribers = new WeakMap<ServerWebSocket<WebSocketData>, () => void>();
const closedSourceSockets = new WeakSet<ServerWebSocket<WebSocketData>>();
const sourceRegistry = new SourceRegistry();

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "access-control-allow-origin": "*" },
  });
}

function decodePathId(parts: string[]) {
  try {
    return decodeURIComponent(parts.join("/")).trim();
  } catch {
    return "";
  }
}

function parseWebSocketRoute(pathname: string): WebSocketData | null {
  const parts = pathname.split("/").filter(Boolean);
  const id = decodePathId(parts.slice(1));

  // Existing generated OBS links keep using these two endpoints.
  if (parts[0] === "c" && id) return { kind: "legacy", mode: "channel", id };
  if (parts[0] === "s" && id && isVideoId(id)) {
    return { kind: "legacy", mode: "stream", id };
  }

  if (parts[0] !== "sources" || parts[2] !== "channels") return null;
  const sourceId = decodePathId(parts.slice(3));
  if (!sourceId) return null;
  if (parts[1] === "youtube") {
    return { kind: "source", route: { platform: "youtube", mode: "channel", id: sourceId } };
  }
  if (parts[1] === "kick") {
    return { kind: "source", route: { platform: "kick", id: sourceId } };
  }
  return null;
}

function send(ws: ServerWebSocket<WebSocketData>, event: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
}

async function openLegacyYouTubeChat(ws: ServerWebSocket<WebSocketData>) {
  if (ws.data.kind !== "legacy") return;
  const videoIds = ws.data.mode === "channel"
    ? await resolveLiveVideoIds(ws.data.id)
    : [ws.data.id];
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
  if (route.platform === "youtube" && !isYouTubeSourceId(route.mode, route.id)) {
    throw new Error("Invalid YouTube source");
  }

  const unsubscribe = await sourceRegistry.subscribe(
    sourceKey(route),
    () => route.platform === "youtube"
      ? new YouTubeSourceWorker(route.mode, route.id)
      : new KickSourceWorker(route.id),
    (event) => send(ws, event),
  );
  if (closedSourceSockets.has(ws)) {
    unsubscribe();
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

const server = Bun.serve<WebSocketData>({
  port,
  hostname,
  fetch(request, serverInstance) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return jsonResponse({ service: "ChatYX chat sources", status: "ok" });
    }

    const route = parseWebSocketRoute(url.pathname);
    if (!route) {
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
      );
    }
    if (serverInstance.upgrade(request, { data: route })) return undefined;
    return jsonResponse({ error: "WebSocket upgrade failed" }, 400);
  },
  websocket: {
    open(ws) {
      closedSourceSockets.delete(ws);
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
      closedSourceSockets.add(ws);
      sourceUnsubscribers.get(ws)?.();
      sourceUnsubscribers.delete(ws);
    },
  },
});

console.log(`[chat-sources] listening on ws://${server.hostname}:${server.port}`);
console.log(`[chat-sources] youtube proxy: ${getYouTubeProxyUrl() || "disabled"}`);
