import { afterEach, describe, expect, test } from "bun:test";
import { fetchRecentMessages } from "../src/services/chat/recentMessagesService";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("recent messages", () => {
  test("merges mirrors so historical USERNOTICE is not lost", async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);
      const messages = url.includes("zneix")
        ? [
            "@id=shared;tmi-sent-ts=100 :a!a@a.tmi.twitch.tv PRIVMSG #channel :first",
            "@id=message-2;tmi-sent-ts=200 :b!b@b.tmi.twitch.tv PRIVMSG #channel :second",
          ]
        : url.includes("robotty")
          ? [
              "@id=shared;tmi-sent-ts=100 :a!a@a.tmi.twitch.tv PRIVMSG #channel :first",
            ]
          : [
              "@id=streak;tmi-sent-ts=300;msg-id=viewermilestone :tmi.twitch.tv USERNOTICE #channel",
            ];

      return new Response(JSON.stringify({ messages }), { status: 200 });
    };

    await expect(fetchRecentMessages("channel", 2)).resolves.toEqual([
      "@id=message-2;tmi-sent-ts=200 :b!b@b.tmi.twitch.tv PRIVMSG #channel :second",
      "@id=streak;tmi-sent-ts=300;msg-id=viewermilestone :tmi.twitch.tv USERNOTICE #channel",
    ]);
  });
});
