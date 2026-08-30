import { describe, expect, test } from "bun:test";
import {
  getEmoteModifier,
  resolveEmoteModifiers,
  type EmoteModifierToken,
} from "../src/utils/chat/emoteModifiers";

function tokens(values: string[], targets: string[] = []): EmoteModifierToken[] {
  return values.map((raw) => ({
    raw,
    isWhitespace: /^\s+$/.test(raw),
    isTarget: targets.includes(raw),
    modifier: getEmoteModifier(raw),
  }));
}

describe("emote modifiers", () => {
  test("folds multiple BTTV prefix modifiers into the following emote", () => {
    const resolved = resolveEmoteModifiers(
      tokens(["p!", " ", "s!", " ", "Kappa"], ["Kappa"]),
    );

    expect(resolved[4]).toEqual({
      effects: ["party", "shake"],
      consumed: false,
      accessibleText: "p! s! Kappa",
    });
    expect(resolved.slice(0, 4).every((token) => token.consumed)).toBe(true);
  });

  test("maps h! to a horizontal flip", () => {
    const resolved = resolveEmoteModifiers(
      tokens(["h!", " ", "Kappa"], ["Kappa"]),
    );

    expect(resolved[2].effects).toEqual(["flip-x"]);
    expect(resolved[0].consumed).toBe(true);
    expect(resolved[1].consumed).toBe(true);
  });

  test("uses z! only to remove spacing before the following emote", () => {
    const resolved = resolveEmoteModifiers(
      tokens(["Kappa", " ", "z!", " ", "Keepo"], ["Kappa", "Keepo"]),
    );

    expect(resolved[4].effects).toEqual([]);
    expect(resolved[0].consumed).toBe(false);
    expect(resolved.slice(1, 4).every((token) => token.consumed)).toBe(true);
  });

  test("folds FFZ suffix modifiers into the preceding emote", () => {
    const resolved = resolveEmoteModifiers(
      tokens(["Kappa", " ", "ffzX", " ", "ffzCursed"], ["Kappa"]),
    );

    expect(resolved[0]).toEqual({
      effects: ["flip-x", "cursed"],
      consumed: false,
      accessibleText: "Kappa ffzX ffzCursed",
    });
    expect(resolved.slice(1).every((token) => token.consumed)).toBe(true);
  });

  test("combines prefix and suffix modifiers around one target", () => {
    const resolved = resolveEmoteModifiers(
      tokens(["w!", " ", "Kappa", " ", "ffzY"], ["Kappa"]),
    );

    expect(resolved[2]).toEqual({
      effects: ["wide", "flip-y"],
      consumed: false,
      accessibleText: "w! Kappa ffzY",
    });
    expect([resolved[0], resolved[1], resolved[3], resolved[4]].every(
      (token) => token.consumed,
    )).toBe(true);
  });

  test("does not consume modifiers across ordinary text or without a target", () => {
    const resolved = resolveEmoteModifiers(
      tokens(["w!", " ", "text", " ", "Kappa", " ", "p!"], ["Kappa"]),
    );

    expect(resolved.every((token) => !token.consumed)).toBe(true);
    expect(resolved[4].effects).toEqual([]);
  });

  test("keeps modifiers scoped to one adjacent target and deduplicates effects", () => {
    const resolved = resolveEmoteModifiers(
      tokens(
        ["p!", " ", "p!", " ", "Kappa", " ", "s!", " ", "Keepo"],
        ["Kappa", "Keepo"],
      ),
    );

    expect(resolved[4].effects).toEqual(["party"]);
    expect(resolved[8].effects).toEqual(["shake"]);
    expect(resolved[4].accessibleText).toBe("p! p! Kappa");
    expect(resolved[8].accessibleText).toBe("s! Keepo");
  });

  test("removes opposing rotations before combining them with wide", () => {
    const resolved = resolveEmoteModifiers(
      tokens(["r!", " ", "l!", " ", "w!", " ", "Kappa"], ["Kappa"]),
    );

    expect(resolved[6]).toEqual({
      effects: ["wide"],
      consumed: false,
      accessibleText: "r! l! w! Kappa",
    });
    expect(resolved.slice(0, 6).every((token) => token.consumed)).toBe(true);
  });
});
