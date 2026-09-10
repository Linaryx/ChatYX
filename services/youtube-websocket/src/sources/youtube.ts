import { connectLiveChat, type LiveChatSession } from "../live-chat";
import type {
  ChatSourceAuthor,
  ChatSourceEvent,
  ChatSourceListener,
  ChatSourceWorker,
} from "../source-events";
import { isVideoId, resolveLiveVideoIds } from "../youtube";

export type YouTubeSourceMode = "channel" | "stream";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asId(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function normalizeAuthor(value: unknown): ChatSourceAuthor {
  const author = asRecord(value);
  const badges = Array.isArray(author.badges)
    ? author.badges.flatMap((value) => {
        const badge = asRecord(value);
        const url = asString(badge.url);
        return url ? [{ url, tooltip: asString(badge.tooltip) || "YouTube badge" }] : [];
      })
    : [];
  return {
    name: asString(author.name) || "YouTube viewer",
    id: asId(author.id) || undefined,
    moderator: Boolean(author.moderator),
    badges,
  };
}

export function normalizeYouTubeMessage(value: unknown): ChatSourceEvent | null {
  const event = asRecord(value);
  const type = asString(event.type);
  if (type !== "message" && type !== "superchat") return null;

  const id = asId(event.id);
  if (!id) return null;

  const unix = Number(event.unix);
  return {
    type: "message",
    platform: "youtube",
    id,
    message: asString(event.message),
    ...(Array.isArray(event.runs) ? { runs: event.runs } : {}),
    author: normalizeAuthor(event.author),
    unix: Number.isFinite(unix) && unix > 0 ? unix : Date.now(),
  };
}

export class YouTubeSourceWorker implements ChatSourceWorker {
  private readonly sessions: LiveChatSession[] = [];
  private stopped = false;

  constructor(
    private readonly mode: YouTubeSourceMode,
    private readonly id: string,
  ) {}

  async start(listener: ChatSourceListener): Promise<void> {
    const videoIds = this.mode === "channel"
      ? await resolveLiveVideoIds(this.id)
      : [this.id];
    let activeStreams = videoIds.length;

    for (const videoId of videoIds) {
      const session = await connectLiveChat(
        videoId,
        (event) => {
          if (this.stopped) return;
          const message = normalizeYouTubeMessage(event);
          if (message) {
            listener(message);
          } else if (asRecord(event).info === "deleted") {
            const messageId = asId(asRecord(event).message);
            if (messageId) listener({ type: "delete", platform: "youtube", messageId });
          } else if (asRecord(event).info === "banned") {
            const userId = asId(asRecord(event).externalChannelId);
            if (userId) listener({ type: "ban", platform: "youtube", userId });
          }
        },
        () => {},
        () => {
          activeStreams -= 1;
          if (activeStreams <= 0 && !this.stopped) {
            listener({
              type: "status",
              platform: "youtube",
              state: "error",
              error: "All live chats have ended",
              retryable: false,
            });
          }
        },
      );
      this.sessions.push(session);
    }

    listener({ type: "status", platform: "youtube", state: "connected" });
  }

  stop() {
    this.stopped = true;
    for (const session of this.sessions) session.stop();
    this.sessions.length = 0;
  }
}

export function isYouTubeSourceId(mode: YouTubeSourceMode, id: string) {
  return mode === "channel" || isVideoId(id);
}
