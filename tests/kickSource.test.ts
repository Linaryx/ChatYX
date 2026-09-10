import { describe, expect, test } from "bun:test";
import {
  normalizeKickMessage,
  normalizeKickHistory,
  normalizeKickRealtimeMessage,
  normalizeKickRealtimeEvent,
} from "../services/youtube-websocket/src/sources/kick";

describe("Kick source normalization", () => {
  test("normalizes a realtime message without requiring authentication data", () => {
    expect(normalizeKickMessage({
      id: "message-1",
      content: "Hello [emote:42:Kappa]",
      created_at: "2026-09-10T12:00:00.000Z",
      sender: {
        id: 42,
        username: "ChatYXViewer",
        identity: {
          color: "#AABBCC",
          badges: [{ type: "moderator" }, { type: "subscriber" }],
          badges_v2: [
            { image_url: "https://cdn.kick.com/badge.png", name: "Moderator" },
            { image_url: "http://invalid.example/badge.png", name: "Ignored" },
          ],
        },
      },
    })).toEqual({
      type: "message",
      platform: "kick",
      id: "message-1",
      message: "Hello Kappa",
      author: {
        name: "ChatYXViewer",
        id: "42",
        color: "#AABBCC",
        moderator: true,
        subscriber: true,
        badges: [{ url: "https://cdn.kick.com/badge.png", tooltip: "Moderator" }],
      },
      unix: Date.parse("2026-09-10T12:00:00.000Z"),
    });
  });

  test("preserves reply context and rejects malformed messages", () => {
    expect(normalizeKickMessage({
      id: "reply-1",
      content: "Reply",
      type: "reply",
      sender: { username: "viewer" },
      metadata: JSON.stringify({
        original_message: { id: "parent-1", content: "Original" },
        original_sender: { id: 1, username: "author" },
      }),
    })).toMatchObject({
      type: "message",
      platform: "kick",
      reply: {
        id: "parent-1",
        message: "Original",
        author: { name: "author", id: "1" },
      },
    });
    expect(normalizeKickMessage({ id: "" })).toBeNull();
  });

  test("unwraps Centrifugo publications from the Kick chat channel", () => {
    expect(normalizeKickRealtimeMessage({
      push: {
        channel: "chatrooms.3124040.v2",
        pub: {
          data: {
            event: "App\\Events\\ChatMessageEvent",
            data: JSON.stringify({
              id: "message-2",
              content: "From realtime",
              sender: { id: 1, username: "viewer" },
            }),
          },
        },
      },
    })).toMatchObject({
      type: "message",
      platform: "kick",
      id: "message-2",
      message: "From realtime",
      author: { name: "viewer", id: "1" },
    });
    expect(normalizeKickRealtimeMessage({ push: { pub: { data: { event: "other" } } } })).toBeNull();
  });

  test("normalizes supported message deletion events", () => {
    const deleted = normalizeKickRealtimeEvent({
      push: {
        pub: {
          data: {
            event: "App\\Events\\ChatMessageDeletedEvent",
            data: JSON.stringify({ message: { id: "deleted-1" } }),
          },
        },
      },
    });
    expect(deleted).toEqual({ type: "delete", platform: "kick", messageId: "deleted-1" });

    expect(normalizeKickRealtimeEvent({
      push: {
        pub: {
          data: {
            event: "App\\Events\\MessageDeletedEvent",
            data: JSON.stringify({ message_id: "deleted-2" }),
          },
        },
      },
    })).toEqual({ type: "delete", platform: "kick", messageId: "deleted-2" });
  });

  test("sorts recent history from oldest to newest", () => {
    expect(normalizeKickHistory({
      data: {
        messages: [
          { id: "newer", content: "Newer", created_at: "2026-09-10T12:01:00.000Z", sender: { username: "viewer" } },
          { id: "older", content: "Older", created_at: "2026-09-10T12:00:00.000Z", sender: { username: "viewer" } },
        ],
      },
    }).map((message) => message.id)).toEqual(["older", "newer"]);
  });
});
