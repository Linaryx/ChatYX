import { describe, expect, test } from "bun:test";
import {
  buildThirdPartyBadgeIndex,
  getIndexedThirdPartyBadges,
} from "../src/services/badges/badgeService";

function createSources() {
  return {
    ffzapBadges: [
      {
        id: 42,
        tier: 2,
        badge_color: "#123456",
      },
    ],
    bttvBadges: [
      {
        name: "MixedUser",
        badge: {
          description: "BTTV Supporter",
          svg: "https://example.com/bttv.svg",
        },
      },
    ],
    chatterinoBadges: [
      {
        tooltip: "Chatterino",
        image3: "https://example.com/chatterino.png",
        users: ["42"],
      },
    ],
    homiesBadges: {
      1: [
        {
          tooltip: "Homie",
          image3: "https://example.com/homie.png",
          users: ["42", "42"],
        },
      ],
      2: [],
      3: [
        {
          userId: "99",
          tooltip: "Tier 3 Homie",
          image3: "https://example.com/homie-3.png",
        },
      ],
    },
  };
}

describe("third-party badge index", () => {
  test("returns badges by user ID and case-insensitive username in render order", () => {
    const index = buildThirdPartyBadgeIndex(createSources());

    const badges = getIndexedThirdPartyBadges(index, "42", "MIXEDUSER");

    expect(badges.map((badge) => badge.source)).toEqual([
      "ffzap",
      "bttv",
      "chatterino",
      "homies",
    ]);
    expect(badges[0].color).toBe("#123456");
  });

  test("indexes tier 3 Homies badges by their single user ID", () => {
    const index = buildThirdPartyBadgeIndex(createSources());

    const badges = getIndexedThirdPartyBadges(index, "99", "other");

    expect(badges).toEqual([
      {
        source: "homies",
        description: "Tier 3 Homie",
        url: "https://example.com/homie-3.png",
      },
    ]);
  });

  test("does not duplicate repeated assignments", () => {
    const index = buildThirdPartyBadgeIndex(createSources());

    const badges = getIndexedThirdPartyBadges(index, "42", "missing");

    expect(
      badges.filter((badge) => badge.url === "https://example.com/homie.png"),
    ).toHaveLength(1);
  });
});
