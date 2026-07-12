import type { ServerWebSocket } from "bun";
import { connectLiveChat, type LiveChatSession } from "./live-chat";
import { getYouTubeProxyUrl, isVideoId, resolveLiveVideoIds } from "./youtube";

type WebSocketData = {
  mode: "channel" | "stream";
  id: string;
};

const port = Number(process.env.PORT || 9905);
const hostname = process.env.HOST || "0.0.0.0";
const sessions = new WeakMap<ServerWebSocket<WebSocketData>, LiveChatSession[]>();

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "access-control-allow-origin": "*",
    },
  });
}

function parseWebSocketRoute(pathname: string): WebSocketData | null {
  const [, mode, ...rest] = pathname.split("/");
  const id = decodeURIComponent(rest.join("/")).trim();
  if (!id) return null;

  if (mode === "c") {
    return { mode: "channel", id };
  }

  if (mode === "s" && isVideoId(id)) {
    return { mode: "stream", id };
  }

  return null;
}

function send(ws: ServerWebSocket<WebSocketData>, event: unknown) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(event));
}

async function openYouTubeChat(ws: ServerWebSocket<WebSocketData>) {
  const videoIds =
    ws.data.mode === "channel"
      ? await resolveLiveVideoIds(ws.data.id)
      : [ws.data.id];
  let activeStreams = videoIds.length;
  const activeSessions: LiveChatSession[] = [];

  sessions.set(ws, activeSessions);

  for (const videoId of videoIds) {
    const session = await connectLiveChat(
      videoId,
      (event) => send(ws, event),
      (reason) => ws.close(1000, reason),
      () => {
        activeStreams -= 1;
        if (activeStreams <= 0) {
          ws.close(1000, "All live chats have ended");
        }
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

function stopSessions(ws: ServerWebSocket<WebSocketData>) {
  const activeSessions = sessions.get(ws);
  if (!activeSessions) return;

  for (const session of activeSessions) {
    session.stop();
  }

  sessions.delete(ws);
}

const server = Bun.serve<WebSocketData>({
  port,
  hostname,
  fetch(request, serverInstance) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", {
        headers: { "access-control-allow-origin": "*" },
      });
    }

    const route = parseWebSocketRoute(url.pathname);
    if (!route) {
      return jsonResponse(
        {
          service: "ChatYX YouTube WebSocket",
          endpoints: ["/c/<handle-or-channel-id>", "/s/<video-id>", "/health"],
        },
        404,
      );
    }

    if (
      serverInstance.upgrade(request, {
        data: route,
      })
    ) {
      return undefined;
    }

    return jsonResponse({ error: "WebSocket upgrade failed" }, 400);
  },
  websocket: {
    open(ws) {
      void openYouTubeChat(ws).catch((error) => {
        const reason = error instanceof Error ? error.message : "Internal error";
        const isExpectedYouTubeState =
          reason.includes("Could not find a live stream") ||
          reason.includes("no available live chat");

        if (isExpectedYouTubeState) {
          console.warn(`[youtube-ws] ${reason}`);
        } else {
          console.error("[youtube-ws] Failed to open live chat", error);
        }

        send(ws, {
          info: "error",
          error: reason,
          retryable: !isExpectedYouTubeState,
        });
        ws.close(isExpectedYouTubeState ? 1000 : 1011, reason);
      });
    },
    message() {
      // The overlay only consumes YouTube events; client commands are not used.
    },
    close(ws) {
      stopSessions(ws);
    },
  },
});

console.log(`[youtube-ws] listening on ws://${server.hostname}:${server.port}`);
console.log(
  `[youtube-ws] youtube proxy: ${getYouTubeProxyUrl() || "disabled"}`,
);
