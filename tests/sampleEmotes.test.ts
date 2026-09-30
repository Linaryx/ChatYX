import { describe, expect, test } from "bun:test";
import {
  buildSampleLine,
  collectSampleEmotePools,
  pickSampleEmotes,
  TWITCH_SAMPLE_EMOTES,
  type SampleEmotePools,
} from "../src/config/sampleEmotes";

const POOLS: SampleEmotePools = {
  sevenTv: ["CatJAM", "peepoHappy"],
  ffz: ["Sadge", "5Head"],
  bttv: ["POGGERS", "monkaS"],
  twitch: TWITCH_SAMPLE_EMOTES.slice(0, 2),
};

describe("sample emote pools", () => {
  test("groups emotes by provider and skips duplicates and cheer emotes", () => {
    const pools = collectSampleEmotePools([
      { name: "CatJAM", source: "7tv" },
      { name: "CatJAM", source: "bttv" },
      { name: "Sadge", source: "ffz" },
      { name: "POGGERS", source: "bttv" },
      { name: "cheer100", source: "cheer" },
      { name: "", source: "7tv" },
    ]);

    expect(pools).toEqual({
      sevenTv: ["CatJAM"],
      ffz: ["Sadge"],
      bttv: ["POGGERS"],
      twitch: TWITCH_SAMPLE_EMOTES,
    });
  });

  test("rotates the starting provider and keeps names from repeating", () => {
    const used = new Set<string>();
    const firstOfEach = [0, 1, 2, 3].map(
      (index) => pickSampleEmotes(POOLS, index, 1, () => 0, used)[0]?.name,
    );

    expect(firstOfEach).toEqual(["CatJAM", "Sadge", "POGGERS", "Kappa"]);

    const nextSevenTv = pickSampleEmotes(POOLS, 0, 1, () => 0, used)[0]?.name;
    expect(nextSevenTv).toBe("peepoHappy");
  });

  test("takes one emote per provider when several are requested", () => {
    const picked = pickSampleEmotes(POOLS, 0, 3, () => 0);

    expect(picked.map((emote) => emote.name)).toEqual([
      "CatJAM",
      "Sadge",
      "POGGERS",
    ]);
    expect(picked.every((emote) => emote.id === undefined)).toBe(true);
  });

  test("returns nothing without a catalogue or a positive count", () => {
    const empty = collectSampleEmotePools([], []);

    expect(pickSampleEmotes(empty, 0, 3, () => 0)).toEqual([]);
    expect(pickSampleEmotes(POOLS, 0, 0, () => 0)).toEqual([]);
  });

  test("joins a phrase with emote tokens and positions the Twitch ones", () => {
    const line = buildSampleLine("привет всем", [
      { name: "LUL", id: "425618" },
      { name: "CatJAM" },
    ]);

    expect(line.message).toBe("привет всем LUL CatJAM");
    expect(line.emotes).toEqual({ "425618": ["12-14"] });
  });

  test("keeps an emote-only line free of a leading space", () => {
    const line = buildSampleLine("", [{ name: "Kappa", id: "25" }]);

    expect(line.message).toBe("Kappa");
    expect(line.emotes).toEqual({ "25": ["0-4"] });
  });
});
