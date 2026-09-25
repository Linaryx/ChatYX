import { describe, expect, test } from "bun:test";
import { normalizeKickSearchResults } from "../services/youtube-websocket/src/kickSearch";

describe("Kick search results", () => {
  test("keeps valid channel identities and HTTPS avatars", () => {
    expect(normalizeKickSearchResults({
      data: {
        channels: [
          {
            slug: "satont",
            username: "Satont",
            profile_picture: "https://files.kick.com/images/user/avatar.webp",
          },
          {
            slug: "invalid channel",
            username: "Ignored",
            profile_picture: "https://example.com/avatar.webp",
          },
        ],
      },
    })).toEqual([
      {
        slug: "satont",
        username: "Satont",
        avatarUrl: "https://files.kick.com/images/user/avatar.webp",
      },
    ]);
  });
});
