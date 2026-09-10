import { describe, expect, test } from "bun:test";
import { normalizeYouTubeMessage } from "../services/youtube-websocket/src/sources/youtube";

describe("YouTube source normalization", () => {
  test("converts regular messages and superchats to the shared source contract", () => {
    expect(normalizeYouTubeMessage({
      type: "superchat",
      id: "paid-1",
      message: "Thanks!",
      unix: 1_789_000_000_000,
      runs: [{ text: "Thanks!" }],
      author: {
        name: "Viewer",
        id: "UC123",
        moderator: true,
        badges: [{ url: "https://yt3.googleusercontent.com/badge", tooltip: "Moderator" }],
      },
    })).toEqual({
      type: "message",
      platform: "youtube",
      id: "paid-1",
      message: "Thanks!",
      unix: 1_789_000_000_000,
      runs: [{ text: "Thanks!" }],
      author: {
        name: "Viewer",
        id: "UC123",
        moderator: true,
        badges: [{ url: "https://yt3.googleusercontent.com/badge", tooltip: "Moderator" }],
      },
    });
  });

  test("rejects events that cannot be displayed as a message", () => {
    expect(normalizeYouTubeMessage({ type: "membership", id: "event-1" })).toBeNull();
    expect(normalizeYouTubeMessage({ type: "message" })).toBeNull();
  });
});
