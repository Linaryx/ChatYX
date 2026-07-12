import { describe, expect, test } from "bun:test";
import {
  mergeBadgesBySetId,
  resolveSenderIdentity,
} from "../src/utils/chat/senderIdentity";

// ---------------------------------------------------------------------------
// resolveSenderIdentity — fresh IRC beats stale GQL
// ---------------------------------------------------------------------------
describe("resolveSenderIdentity", () => {
  test("Given non-empty IRC displayName and color When resolving Then IRC values win over GQL", () => {
    // Given: IRC provides a fresh identity, GQL cache is stale
    const ircDisplayName = "CoolUser";
    const ircColor = "#FF0000";
    const gqlDisplayName = "OldUser";
    const gqlColor = "#0000FF";

    // When: resolving the final identity
    const identity = resolveSenderIdentity(
      ircDisplayName,
      ircColor,
      gqlDisplayName,
      gqlColor,
    );

    // Then: IRC values take precedence
    expect(identity.displayName).toBe("CoolUser");
    expect(identity.color).toBe("#FF0000");
  });

  test("Given empty IRC displayName and non-empty GQL When resolving Then GQL fills the gap", () => {
    // Given: IRC has no display name but GQL does
    const identity = resolveSenderIdentity("", "", "GqlUser", "#00FF00");

    // When / Then
    expect(identity.displayName).toBe("GqlUser");
    expect(identity.color).toBe("#00FF00");
  });

  test("Given empty IRC color and non-empty GQL color When resolving Then GQL color fills the gap", () => {
    // Given: IRC has a display name but no color
    const identity = resolveSenderIdentity("User", "", "GqlUser", "#00FF00");

    // Then: IRC displayName preserved, GQL color used as fallback
    expect(identity.displayName).toBe("User");
    expect(identity.color).toBe("#00FF00");
  });

  test("Given both IRC and GQL empty When resolving Then both fields are empty strings", () => {
    // Given: neither source has identity data
    const identity = resolveSenderIdentity("", "", "", "");

    // Then: both fields are empty
    expect(identity.displayName).toBe("");
    expect(identity.color).toBe("");
  });
});

// ---------------------------------------------------------------------------
// mergeBadgesBySetId — GQL replaces IRC by set ID, appends new sets
// ---------------------------------------------------------------------------
describe("mergeBadgesBySetId", () => {
  test("Given same badge set in IRC and GQL When merging Then GQL version replaces IRC version and returns one entry", () => {
    // Given: IRC has "broadcaster/1", GQL has version "2" for the same set
    const merged = mergeBadgesBySetId(["broadcaster/1"], [
      { setId: "broadcaster", version: "2" },
    ]);

    // Then: the merged result has exactly one entry with GQL's version
    expect(merged).toEqual(["broadcaster/2"]);
  });

  test("Given duplicate versions of one IRC badge set When merging Then only the latest version remains", () => {
    const merged = mergeBadgesBySetId(
      ["subscriber/12", "vip/1", "subscriber/24"],
      [],
    );

    expect(merged).toEqual(["subscriber/24", "vip/1"]);
  });

  test("Given multiple IRC badges and one GQL collision When merging Then only the colliding set ID is replaced", () => {
    // Given: IRC has three badges, GQL replaces one of them
    const merged = mergeBadgesBySetId(
      ["broadcaster/1", "subscriber/12", "vip/1"],
      [{ setId: "subscriber", version: "24" }],
    );

    // Then: only subscriber version changed, order preserved
    expect(merged).toEqual(["broadcaster/1", "subscriber/24", "vip/1"]);
  });

  test("Given GQL badges with new set IDs When merging Then they are appended after all IRC entries", () => {
    // Given: IRC badges and GQL badges with no overlapping set IDs
    const merged = mergeBadgesBySetId(
      ["broadcaster/1"],
      [{ setId: "vip", version: "1" }, { setId: "subscriber", version: "3" }],
    );

    // Then: IRC entries first, then new GQL sets in order
    expect(merged).toEqual(["broadcaster/1", "vip/1", "subscriber/3"]);
  });

  test("Given GQL badges from setID (camelCase) When merging Then they are recognized the same as setId", () => {
    // Given: GQL uses setID instead of setId
    const merged = mergeBadgesBySetId(["broadcaster/1"], [
      { setID: "broadcaster", version: "5" },
    ]);

    // Then: GQL replaces by setID as well
    expect(merged).toEqual(["broadcaster/5"]);
  });

  test("Given malformed GQL entries with empty setId or version When merging Then they are skipped", () => {
    // Given: GQL has entries with empty setId and empty version
    const merged = mergeBadgesBySetId(["a/1"], [
      { setId: "", version: "2" },
      { setId: "b", version: "" },
      { setId: "c", version: "3" },
    ]);

    // Then: only "c/3" is appended; empty setId and empty version are skipped
    expect(merged).toEqual(["a/1", "c/3"]);
  });

  test("Given no GQL badges When merging Then IRC badges are returned unchanged", () => {
    // Given: only IRC badges, no GQL data
    const merged = mergeBadgesBySetId(["a/1", "b/2"], []);

    // Then: result equals the IRC input
    expect(merged).toEqual(["a/1", "b/2"]);
  });

  test("Given no IRC badges When merging Then GQL badges become the result", () => {
    // Given: no IRC badges, only GQL data
    const merged = mergeBadgesBySetId([], [
      { setId: "x", version: "9" },
    ]);

    // Then: result contains only the GQL entry
    expect(merged).toEqual(["x/9"]);
  });
});

// ---------------------------------------------------------------------------
// normalize-only contract: every message keeps its own raw IRC badge data
// ---------------------------------------------------------------------------
describe("mergeBadgesBySetId with empty GQL", () => {
  test("Given duplicate IRC versions of the same set When normalizing Then only the latest version remains", () => {
    const normalized = mergeBadgesBySetId(
      ["subscriber/12", "vip/1", "subscriber/24"],
      [],
    );

    expect(normalized).toEqual(["subscriber/24", "vip/1"]);
  });

  test("Given empty GQL input When normalizing Then IRC badges are returned unchanged except for deduplication", () => {
    const normalized = mergeBadgesBySetId(["broadcaster/1", "subscriber/3"], []);

    expect(normalized).toEqual(["broadcaster/1", "subscriber/3"]);
  });

  test("Given a malformed IRC badge When normalizing Then it is skipped", () => {
    const normalized = mergeBadgesBySetId(["broadcaster/1", "invalid", "/2", "a/"], []);

    expect(normalized).toEqual(["broadcaster/1"]);
  });
});
