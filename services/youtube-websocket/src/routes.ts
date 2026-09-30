import type { YouTubeSourceMode } from "./sources/youtube";
import { isVideoId } from "./youtube";

export type SourceRoute =
  | { platform: "youtube"; mode: YouTubeSourceMode; id: string }
  | { platform: "kick"; id: string };

export type WebSocketRoute =
  | { kind: "legacy"; mode: YouTubeSourceMode; id: string }
  | { kind: "source"; route: SourceRoute };

export type RouteLimits = {
  /** Hard cap applied before the platform rules, so a huge path is cheap to reject. */
  readonly maxChannelNameLength: number;
};

export type RouteMatch =
  | { readonly matched: true; readonly route: WebSocketRoute }
  | { readonly matched: false; readonly reason: "invalid_id" | "unknown" };

/** YouTube handles: 3-30 characters, latin letters, digits, dot, dash, underscore. */
const YOUTUBE_HANDLE_PATTERN = /^@?[A-Za-z0-9._-]{3,30}$/;
/** YouTube channel ids: `UC` plus the 22-character channel hash. */
const YOUTUBE_CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
/** Kick usernames: 3-25 characters, latin letters, digits, dash, underscore. */
const KICK_SLUG_PATTERN = /^[A-Za-z0-9_-]{3,25}$/;

export function isYouTubeChannelId(value: string): boolean {
  return YOUTUBE_CHANNEL_ID_PATTERN.test(value) || YOUTUBE_HANDLE_PATTERN.test(value);
}

export function isKickSlug(value: string): boolean {
  return KICK_SLUG_PATTERN.test(value);
}

function decodePathId(parts: string[]): string {
  try {
    return decodeURIComponent(parts.join("/")).trim();
  } catch {
    return "";
  }
}

const INVALID_ID: RouteMatch = { matched: false, reason: "invalid_id" };
const UNKNOWN_ROUTE: RouteMatch = { matched: false, reason: "unknown" };

/**
 * Parses a WebSocket path and validates the channel identifier for its
 * platform. Malformed or oversized identifiers are rejected before the upgrade,
 * so they never reach the upstream workers.
 */
export function resolveWebSocketRoute(
  pathname: string,
  limits: RouteLimits,
): RouteMatch {
  const parts = pathname.split("/").filter(Boolean);

  // Existing generated OBS links keep using these two endpoints.
  if (parts[0] === "c") {
    const id = decodePathId(parts.slice(1));
    if (!id || id.length > limits.maxChannelNameLength) return INVALID_ID;
    return isYouTubeChannelId(id)
      ? { matched: true, route: { kind: "legacy", mode: "channel", id } }
      : INVALID_ID;
  }
  if (parts[0] === "s") {
    const id = decodePathId(parts.slice(1));
    if (!id || id.length > limits.maxChannelNameLength) return INVALID_ID;
    return isVideoId(id)
      ? { matched: true, route: { kind: "legacy", mode: "stream", id } }
      : INVALID_ID;
  }

  if (parts[0] !== "sources" || parts[2] !== "channels") return UNKNOWN_ROUTE;
  const sourceId = decodePathId(parts.slice(3));
  if (!sourceId || sourceId.length > limits.maxChannelNameLength) return INVALID_ID;
  if (parts[1] === "youtube") {
    return isYouTubeChannelId(sourceId)
      ? {
          matched: true,
          route: { kind: "source", route: { platform: "youtube", mode: "channel", id: sourceId } },
        }
      : INVALID_ID;
  }
  if (parts[1] === "kick") {
    return isKickSlug(sourceId)
      ? { matched: true, route: { kind: "source", route: { platform: "kick", id: sourceId } } }
      : INVALID_ID;
  }
  return UNKNOWN_ROUTE;
}
