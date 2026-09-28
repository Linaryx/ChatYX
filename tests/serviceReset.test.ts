import { expect, test } from "bun:test";
import { badgeService } from "../src/services/badges/badgeService";
import { emoteService } from "../src/services/chat/assets/emoteService";

const emote = (name: string) => ({
  id: `id-${name}`,
  name,
  url: `https://example.test/${name}.png`,
  source: "bttv" as const,
});

test("emoteService.reset clears channel and personal emotes", () => {
  emoteService.addChannelEmote("channel-a", "Kappa", emote("Kappa"));
  emoteService.addPersonalEmote("viewer", "Mine", emote("Mine"));

  expect(emoteService.getEmote("Kappa", "channel-a")).toBeDefined();
  expect(emoteService.getPersonalEmotes("viewer").Mine).toBeDefined();

  emoteService.reset();

  expect(emoteService.getEmote("Kappa", "channel-a")).toBeUndefined();
  expect(emoteService.getPersonalEmotes("viewer").Mine).toBeUndefined();
  expect(emoteService.getEmoteData().emotes).toEqual({});
  expect(emoteService.getEmoteData().channelEmotes).toEqual({});
  expect(emoteService.getEmoteData().personalEmotes).toEqual({});
});

test("badgeService.reset keeps the built-in fallback badges", () => {
  // The fallbacks are the reason reset cannot simply empty the store: a fresh
  // service starts with them, so a reset service must too.
  const before = badgeService.getTwitchBadge("moderator", "1");
  expect(before).toBeTruthy();

  badgeService.reset();

  expect(badgeService.getTwitchBadge("moderator", "1")).toBe(before);
});

test("badgeService.reset drops badges added at runtime", () => {
  badgeService.addSevenTVBadge("probe-badge", { host: { url: "//cdn.example.test" } });
  expect(Object.keys(badgeService.getBadgeData().seventvBadges)).toContain("probe-badge");
  expect(badgeService.getBadgeData().badges["7tv:probe-badge"]).toBeTruthy();

  badgeService.reset();

  expect(Object.keys(badgeService.getBadgeData().seventvBadges)).toHaveLength(0);
  expect(badgeService.getBadgeData().badges["7tv:probe-badge"]).toBeUndefined();
});

test("a reset badge store does not leak state into the next reset", () => {
  badgeService.addSevenTVBadge("first", { host: { url: "//cdn.example.test" } });
  badgeService.reset();
  badgeService.addSevenTVBadge("second", { host: { url: "//cdn.example.test" } });
  badgeService.reset();

  // If reset snapshotted the live store instead of the initial one, the second
  // reset would restore "first" as well.
  expect(Object.keys(badgeService.getBadgeData().seventvBadges)).toHaveLength(0);
});
