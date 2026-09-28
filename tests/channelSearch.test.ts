import { describe, expect, test } from "bun:test";
import { normalizeTwitchSearchSuggestions } from "../src/services/setup/channelSearch";

describe("Twitch search suggestions", () => {
  test("keeps channel suggestions with HTTPS avatars", () => {
    expect(normalizeTwitchSearchSuggestions([{
      data: {
        searchSuggestions: {
          edges: [{
            text: "Linaryx",
            node: {
              content: {
                __typename: "SearchSuggestionChannel",
                login: "linaryx",
                profileImageURL: "https://static-cdn.jtvnw.net/avatar.png",
              },
            },
          }],
        },
      },
    }])).toEqual([{
      login: "linaryx",
      displayName: "Linaryx",
      avatarUrl: "https://static-cdn.jtvnw.net/avatar.png",
    }]);
  });
});
