import { describe, expect, test } from "bun:test";
import { parsePreviewChatters } from "../src/services/chat/preview/userPool";

describe("preview chatter sources", () => {
  test("parses the nested markzynk response", () => {
    expect(
      parsePreviewChatters({
        chatters: {
          broadcasters: ["streamer"],
          moderators: ["mod"],
          vips: ["vip"],
          staff: [],
          viewers: ["viewer"],
        },
      }),
    ).toEqual({
      broadcasters: ["streamer"],
      moderators: ["mod"],
      vips: ["vip"],
      staff: [],
      viewers: ["viewer"],
      chatbots: [],
    });
  });

  test("parses the flat tackling response and ignores invalid entries", () => {
    expect(
      parsePreviewChatters({
        broadcasters: [],
        moderators: ["mod", null],
        vips: [],
        staff: [],
        viewers: ["viewer", 42],
        chatbots: ["bot"],
      }),
    ).toEqual({
      broadcasters: [],
      moderators: ["mod"],
      vips: [],
      staff: [],
      viewers: ["viewer"],
      chatbots: ["bot"],
    });
  });
});
