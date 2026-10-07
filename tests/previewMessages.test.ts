import { describe, expect, test } from "bun:test";
import type { ChatPresentationService } from "../src/services/chat";
import {
  createPreviewMessages,
  resetUserPool,
} from "../src/services/chat/preview";
import { emoteService, type Emote } from "../src/services/chat/assets/emoteService";
import { TWITCH_SAMPLE_EMOTES } from "../src/config/sampleEmotes";
import { isReplyEligibleEvent } from "../src/utils/chat/replyEligibility";

const service = {} as ChatPresentationService;

function emote(name: string, source: Emote["source"]): Emote {
  return { id: `id-${name}`, name, url: `https://example.test/${name}.webp`, source };
}

const PROVIDER_BY_NAME = new Map<string, string>([
  ["CatJAM", "7tv"],
  ["Sadge", "ffz"],
  ["POGGERS", "bttv"],
]);

describe("chat preview messages", () => {
  test("synthetic demo authors recur so a timeout can demonstrate batch deletion", () => {
    resetUserPool();
    const messages = createPreviewMessages("channel", service, "0", "pasta", 24);
    expect(new Set(messages.map((message) => message.username)).size).toBeLessThan(messages.length);
  });
  test("does not attach replies to rewards, raids, or announcements", () => {
    resetUserPool();
    const messages = createPreviewMessages("channel", service, "0", "pasta", 13);

    const reward = messages.find((message) => message.twitchEvent?.type === "reward");
    const raid = messages.find((message) => message.twitchEvent?.type === "raid");
    const announcement = messages.find(
      (message) => message.twitchEvent?.type === "announcement",
    );

    expect(reward?.reply).toBeUndefined();
    expect(raid?.reply).toBeUndefined();
    expect(announcement?.reply).toBeUndefined();
  });

  test("uses varied chat messages in the default demo", () => {
    resetUserPool();
    const messages = createPreviewMessages("channel", service, "0", "pasta", 10);
    const chatTexts = messages
      .filter((message) => !message.twitchEvent)
      .map((message) => message.message);

    expect(new Set(chatTexts).size).toBeGreaterThan(1);
  });

  test("adds the animated GIF preview only when GIFs are enabled", () => {
    resetUserPool();
    const disabled = createPreviewMessages("channel", service, "0", "pasta", 6, false);
    expect(disabled.some((message) => message.gifs)).toBe(false);

    resetUserPool();
    const enabled = createPreviewMessages("channel", service, "0", "pasta", 6, true);
    const gif = enabled.find((message) => message.gifs);
    expect(gif?.message).toBe("[GIF]");
    expect(gif?.gifs?.[0]?.url).toContain("giphy.webp");
    expect(gif?.reply).toBeUndefined();
  });

  test("limits reply previews to reply-capable authored messages", () => {
    expect(isReplyEligibleEvent(undefined)).toBeTrue();
    expect(isReplyEligibleEvent("first-message")).toBeTrue();
    expect(isReplyEligibleEvent("highlighted-message")).toBeTrue();
    expect(isReplyEligibleEvent("reward")).toBeFalse();
    expect(isReplyEligibleEvent("announcement")).toBeFalse();
  });

  test("mixes 7TV, FFZ, BTTV and Twitch emotes in the messages demo", () => {
    resetUserPool();
    emoteService.reset();
    emoteService.addChannelEmote("0", "CatJAM", emote("CatJAM", "7tv"));
    emoteService.addChannelEmote("0", "Sadge", emote("Sadge", "ffz"));
    emoteService.addChannelEmote("0", "POGGERS", emote("POGGERS", "bttv"));

    try {
      const messages = createPreviewMessages("channel", service, "0", "pasta", 12);

      const providers = new Set<string>();
      for (const message of messages) {
        for (const word of message.message.split(/\s+/)) {
          const provider = PROVIDER_BY_NAME.get(word.replace(/^@/, ""));
          if (provider) providers.add(provider);
        }
      }
      expect(providers.size).toBeGreaterThanOrEqual(3);

      const withTwitchEmote = messages.find(
        (message) => Object.keys(message.emotes).length > 0,
      );
      expect(withTwitchEmote).toBeDefined();
      for (const [id, positions] of Object.entries(
        (withTwitchEmote?.emotes ?? {}) as Record<string, string[]>,
      )) {
        const expectedName = TWITCH_SAMPLE_EMOTES.find((emote) => emote.id === id)?.name;
        const codePoints = [...(withTwitchEmote?.message ?? "")];
        for (const position of positions) {
          const [start, end] = position.split("-").map(Number);
          expect(codePoints.slice(start, end + 1).join("")).toBe(expectedName);
        }
      }
    } finally {
      emoteService.reset();
    }
  });
});
