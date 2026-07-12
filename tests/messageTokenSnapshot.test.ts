import { describe, expect, test } from "bun:test";
import { createMessageTokenSnapshot } from "../src/utils/chat/emojiUtils";

describe("message token snapshot", () => {
  test("preserves whitespace as separate tokens", () => {
    const snapshot = createMessageTokenSnapshot("hello  world\nnext");

    expect(snapshot.source).toBe("hello  world\nnext");
    expect(snapshot.tokens.map((token) => token.raw)).toEqual([
      "hello",
      "  ",
      "world",
      "\n",
      "next",
    ]);
    expect(snapshot.tokens.filter((token) => token.isWhitespace)).toHaveLength(2);
  });

  test("extracts emoji placeholders and clean lookup text once", () => {
    const emoji = "\u{1F600}";
    const snapshot = createMessageTokenSnapshot(`Kappa${emoji} ${emoji}`);

    expect(snapshot.tokens[0]).toMatchObject({
      withPlaceholders: "Kappa__EMOJI0__",
      emojis: [emoji],
      cleanText: "Kappa",
    });
    expect(snapshot.tokens[2]).toMatchObject({
      withPlaceholders: "__EMOJI0__",
      emojis: [emoji],
      cleanText: "",
    });
  });

  test("keeps the source text for cache validation", () => {
    const snapshot = createMessageTokenSnapshot("original");

    expect(snapshot.source).not.toBe("processed");
  });
});
