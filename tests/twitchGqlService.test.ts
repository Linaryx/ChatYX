import { afterEach, describe, expect, test } from "bun:test";
import {
  parseLeaderboardUsers,
  twitchGqlService,
} from "../src/services/chat/twitchGqlService";

const originalFetch = globalThis.fetch;
const originalWindow = (globalThis as any).window;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) {
    delete (globalThis as any).window;
  } else {
    (globalThis as any).window = originalWindow;
  }
});

describe("Twitch GQL leaderboards", () => {
  test("collects and deduplicates leaderboard users", () => {
    const repeatedUser = {
      id: "1",
      login: "viewer_one",
      displayName: "ViewerOne",
    };
    const users = parseLeaderboardUsers({
      user: {
        channel: {
          leaderboardSet: {
            bits: {
              items: {
                edges: [
                  { node: { user: repeatedUser } },
                  { node: { user: null } },
                ],
              },
            },
            subGift: {
              items: {
                edges: [
                  { node: { user: repeatedUser } },
                  {
                    node: {
                      user: { id: "2", login: "gifter", displayName: "Gifter" },
                    },
                  },
                ],
              },
            },
            clip: {
              items: {
                edges: [
                  {
                    node: {
                      clip: {
                        assets: [
                          {
                            curator: {
                              id: "3",
                              login: "clipper",
                              displayName: "Clipper",
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
    });

    expect(users).toEqual([
      repeatedUser,
      { id: "2", login: "gifter", displayName: "Gifter" },
      { id: "3", login: "clipper", displayName: "Clipper" },
    ]);
  });

  test("loads multiple senders in one GQL request and caches them", async () => {
    (globalThis as any).window = {
      setTimeout,
      clearTimeout,
    };
    let requestCount = 0;
    globalThis.fetch = (async (_input, init) => {
      requestCount += 1;
      const operations = JSON.parse(String(init?.body));
      expect(Array.isArray(operations)).toBe(true);
      expect(operations).toHaveLength(2);

      return new Response(
        JSON.stringify(
          operations.map((operation: any) => ({
            data: {
              user: {
                id: operation.variables.senderID,
                login: `user_${operation.variables.senderID}`,
                displayName: `User ${operation.variables.senderID}`,
                chatColor: "#9146ff",
                displayBadges: [],
              },
            },
          })),
        ),
        { status: 200 },
      );
    }) as typeof fetch;

    const senders = await twitchGqlService.loadSenders("991001", [
      "991002",
      "991003",
    ]);

    expect(Array.from(senders.keys())).toEqual(["991002", "991003"]);
    expect(await twitchGqlService.loadSender("991001", "991002")).toEqual(
      senders.get("991002"),
    );
    expect(requestCount).toBe(1);
  });
});
