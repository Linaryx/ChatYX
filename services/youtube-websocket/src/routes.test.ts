import { describe, expect, test } from "bun:test";
import { resolveWebSocketRoute, type RouteLimits } from "./routes";

const LIMITS: RouteLimits = { maxChannelNameLength: 64 };

describe("websocket route resolution", () => {
  test("accepts the generated overlay links", () => {
    expect(resolveWebSocketRoute("/sources/youtube/channels/@SomeHandle", LIMITS)).toEqual({
      matched: true,
      route: {
        kind: "source",
        route: { platform: "youtube", mode: "channel", id: "@SomeHandle" },
      },
    });
    expect(resolveWebSocketRoute("/sources/youtube/channels/UC1234567890abcdefghijkl", LIMITS)).toEqual({
      matched: true,
      route: {
        kind: "source",
        route: { platform: "youtube", mode: "channel", id: "UC1234567890abcdefghijkl" },
      },
    });
    expect(resolveWebSocketRoute("/sources/kick/channels/xqc", LIMITS)).toEqual({
      matched: true,
      route: { kind: "source", route: { platform: "kick", id: "xqc" } },
    });
  });

  test("keeps the legacy endpoint shapes", () => {
    expect(resolveWebSocketRoute("/c/@handle", LIMITS)).toEqual({
      matched: true,
      route: { kind: "legacy", mode: "channel", id: "@handle" },
    });
    expect(resolveWebSocketRoute("/s/dQw4w9WgXcQ", LIMITS)).toEqual({
      matched: true,
      route: { kind: "legacy", mode: "stream", id: "dQw4w9WgXcQ" },
    });
  });

  test("trims and decodes the identifier", () => {
    expect(resolveWebSocketRoute("/sources/kick/channels/%20xqc%20", LIMITS)).toEqual({
      matched: true,
      route: { kind: "source", route: { platform: "kick", id: "xqc" } },
    });
  });

  test("treats malformed identifiers as invalid, not as unknown routes", () => {
    const invalid = [
      "/c/",
      "/c/a b",
      "/c/%E0%A4%A",
      "/s/short",
      "/sources/youtube/channels/x",
      "/sources/youtube/channels/@ab",
      "/sources/kick/channels/ab",
      "/sources/kick/channels/this-slug-is-way-too-longer",
      "/sources/kick/channels/bad!slug",
      "/sources/kick/channels/a/b",
    ];

    for (const pathname of invalid) {
      expect(resolveWebSocketRoute(pathname, LIMITS)).toEqual({
        matched: false,
        reason: "invalid_id",
      });
    }
  });

  test("rejects identifiers longer than the configured cap", () => {
    expect(resolveWebSocketRoute("/sources/kick/channels/abcdefghij", {
      maxChannelNameLength: 8,
    })).toEqual({ matched: false, reason: "invalid_id" });
    expect(resolveWebSocketRoute("/sources/kick/channels/abcdefgh", {
      maxChannelNameLength: 8,
    }).matched).toBe(true);
  });

  test("reports unknown paths separately", () => {
    for (const pathname of ["/", "/foo", "/sources/twitch/channels/xqc", "/sources/kick/xqc", "/health"]) {
      expect(resolveWebSocketRoute(pathname, LIMITS)).toEqual({
        matched: false,
        reason: "unknown",
      });
    }
  });
});
