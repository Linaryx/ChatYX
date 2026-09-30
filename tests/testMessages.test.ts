import { describe, expect, test } from "bun:test";
import {
  TWITCH_SAMPLE_EMOTES,
  type SampleEmotePools,
} from "../src/config/sampleEmotes";
import { createTestMessages } from "../src/features/chat-overlay/model/testMessages";

const POOL: SampleEmotePools = {
  sevenTv: ["CatJAM", "peepoHappy", "RainTime"],
  ffz: ["5Head", "Sadge", "FeelsOkayMan"],
  bttv: ["POGGERS", "monkaS", "EZ"],
  twitch: TWITCH_SAMPLE_EMOTES.slice(0, 4),
};

const PROVIDER_BY_NAME = new Map<string, string>([
  ...POOL.sevenTv.map((name) => [name, "7tv"] as const),
  ...POOL.ffz.map((name) => [name, "ffz"] as const),
  ...POOL.bttv.map((name) => [name, "bttv"] as const),
  ...POOL.twitch.map((emote) => [emote.name, "twitch"] as const),
]);

/** Deterministic stand-in for `Math.random` so assertions stay stable. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function emoteNames(message: { message: string }): string[] {
  return message.message
    .split(/\s+/)
    .filter((word) => PROVIDER_BY_NAME.has(word));
}

describe("test messages", () => {
  test("builds the requested number of short chat lines", () => {
    const messages = createTestMessages({
      count: 6,
      emotes: POOL,
      random: seededRandom(1),
    });

    expect(messages).toHaveLength(6);
    expect(new Set(messages.map((message) => message.username)).size).toBe(6);
    for (const message of messages) {
      expect(message.platform).toBe("twitch");
      expect(message.username).toMatch(/^[a-z]+\d+$/);
      expect(message.username).not.toStartWith("chatyx");
      expect(message.displayName).toBe(message.username);
      expect(message.message.length).toBeLessThanOrEqual(40);
      expect(message.message.startsWith("!")).toBe(false);
      expect(message.color).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  test("covers several emote providers in one batch", () => {
    const messages = createTestMessages({
      count: 6,
      emotes: POOL,
      random: seededRandom(7),
    });

    const providers = new Set<string>();
    for (const message of messages) {
      const names = emoteNames(message);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) providers.add(PROVIDER_BY_NAME.get(name)!);
    }

    expect(providers.size).toBeGreaterThanOrEqual(3);
  });

  test("points Twitch emote positions at the emote name", () => {
    const messages = createTestMessages({
      count: 12,
      emotes: POOL,
      random: seededRandom(21),
    });

    let checked = 0;
    for (const message of messages) {
      const codePoints = [...message.message];
      for (const [id, positions] of Object.entries(
        message.emotes as Record<string, string[]>,
      )) {
        const expectedName = POOL.twitch.find((emote) => emote.id === id)?.name;
        expect(expectedName).toBeDefined();
        for (const position of positions) {
          const [start, end] = position.split("-").map(Number);
          expect(codePoints.slice(start, end + 1).join("")).toBe(expectedName);
        }
        checked += 1;
      }
    }

    expect(checked).toBeGreaterThan(0);
  });

  test("gives every message a chat-realistic badge set", () => {
    const messages = createTestMessages({
      count: 40,
      emotes: POOL,
      random: seededRandom(99),
    });

    const knownSets = ["broadcaster", "moderator", "vip", "founder", "subscriber"];
    for (const message of messages) {
      for (const badge of message.badges) {
        const [setId, version] = badge.split("/");
        expect(knownSets).toContain(setId);
        expect(version).toMatch(/^\d+$/);
      }
      expect(message.badges.length).toBeLessThanOrEqual(2);
      expect(
        message.badges.some((badge) => badge.startsWith("moderator/")),
      ).toBe(message.isModerator);
    }
  });

  test("repeats a batch from the same seed", () => {
    const first = createTestMessages({ count: 5, emotes: POOL, random: seededRandom(42) });
    const second = createTestMessages({ count: 5, emotes: POOL, random: seededRandom(42) });

    const strip = (messages: typeof first) =>
      messages.map(({ id: _id, timestamp: _timestamp, ...rest }) => rest);
    expect(strip(first)).toEqual(strip(second));
  });

  test("still builds messages without an emote pool", () => {
    const messages = createTestMessages({
      count: 3,
      emotes: { sevenTv: [], ffz: [], bttv: [], twitch: [] },
      random: seededRandom(3),
    });

    expect(messages).toHaveLength(3);
    for (const message of messages) {
      expect(message.emotes).toEqual({});
      expect(message.message).toBe(message.message.trim());
      expect(message.message.split(/\s+/).length).toBeGreaterThan(0);
    }
  });
});
