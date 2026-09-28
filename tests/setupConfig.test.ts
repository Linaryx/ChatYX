import { expect, test } from "bun:test";
import {
  DEFAULT_CHAT_CONFIG,
  parseBotNames,
  parseChatConfigFromSearchParams,
} from "../src/config/chatUrlParams";
import { DEFAULT_EVENT_COLORS } from "../src/config/eventColors";
import {
  buildOverlayUrl,
  buildSetupConfig,
  type SetupFormState,
} from "../src/config/setupConfig";
import { MIN_MESSAGE_SPEED } from "../src/config/chatAnimation";

/** Mirrors how the route seeds an `intOrFalse` field as a form string. */
const optionalIntToForm = (value: number | false): string =>
  value === false ? "0" : String(value);

/** A form at its defaults, so each test only states what it changes. */
function createForm(overrides: Partial<SetupFormState> = {}): SetupFormState {
  return {
    youtubeChannel: "",
    kickChannel: "",
    size: String(DEFAULT_CHAT_CONFIG.size),
    font: String(DEFAULT_CHAT_CONFIG.font),
    lineHeight: String(DEFAULT_CHAT_CONFIG.lineHeight),
    fontWeight: String(DEFAULT_CHAT_CONFIG.fontWeight),
    nickFontWeight: String(DEFAULT_CHAT_CONFIG.nickFontWeight),
    fontCustom: "",
    shadow: optionalIntToForm(DEFAULT_CHAT_CONFIG.shadow),
    stroke: optionalIntToForm(DEFAULT_CHAT_CONFIG.stroke),
    fade: optionalIntToForm(DEFAULT_CHAT_CONFIG.fade),
    animation: DEFAULT_CHAT_CONFIG.animation,
    messageSpeed: String(DEFAULT_CHAT_CONFIG.messageSpeed),
    showHomies: DEFAULT_CHAT_CONFIG.showHomies,
    show7tvBadges: DEFAULT_CHAT_CONFIG.show7tvBadges,
    showFfzBadges: DEFAULT_CHAT_CONFIG.showFfzBadges,
    showBttvBadges: DEFAULT_CHAT_CONFIG.showBttvBadges,
    showChatterinoBadges: DEFAULT_CHAT_CONFIG.showChatterinoBadges,
    showChatisBadges: DEFAULT_CHAT_CONFIG.showChatisBadges,
    showTwitchBadges: DEFAULT_CHAT_CONFIG.showTwitchBadges,
    showYouTubeBadges: DEFAULT_CHAT_CONFIG.showYouTubeBadges,
    showKickBadges: DEFAULT_CHAT_CONFIG.showKickBadges,
    recentMessages: DEFAULT_CHAT_CONFIG.recentMessages,
    bots: DEFAULT_CHAT_CONFIG.bots,
    commands: DEFAULT_CHAT_CONFIG.commands,
    hideAllBadges: DEFAULT_CHAT_CONFIG.hideAllBadges,
    emoteScale: String(DEFAULT_CHAT_CONFIG.emoteScale),
    showGifs: DEFAULT_CHAT_CONFIG.showGifs,
    gifScale: String(DEFAULT_CHAT_CONFIG.gifScale),
    botNames: parseBotNames(DEFAULT_CHAT_CONFIG.botNames),
    kickBotNames: parseBotNames(DEFAULT_CHAT_CONFIG.kickBotNames),
    youtubeBotNames: parseBotNames(DEFAULT_CHAT_CONFIG.youtubeBotNames),
    allowedChatters: [],
    show7tvUnlisted: DEFAULT_CHAT_CONFIG.show7tvUnlisted,
    smallCaps: DEFAULT_CHAT_CONFIG.smallCaps,
    nlAfterName: DEFAULT_CHAT_CONFIG.nlAfterName,
    hideNames: DEFAULT_CHAT_CONFIG.hideNames,
    reverseLineOrder: DEFAULT_CHAT_CONFIG.reverseLineOrder,
    horizontal: DEFAULT_CHAT_CONFIG.horizontal,
    platformMarker: DEFAULT_CHAT_CONFIG.platformMarker,
    ffzBotMixBroadcaster: DEFAULT_CHAT_CONFIG.ffzBotMixBroadcaster,
    ffzBotMixModerator: DEFAULT_CHAT_CONFIG.ffzBotMixModerator,
    ffzBotMixVip: DEFAULT_CHAT_CONFIG.ffzBotMixVip,
    overlayBackgroundColor: DEFAULT_CHAT_CONFIG.overlayBackgroundColor,
    overlayBackgroundOpacity: String(DEFAULT_CHAT_CONFIG.overlayBackgroundOpacity),
    overlayBackgroundRadius: String(DEFAULT_CHAT_CONFIG.overlayBackgroundRadius),
    overlayPadding: String(DEFAULT_CHAT_CONFIG.overlayPadding),
    overlayBorderWidth: String(DEFAULT_CHAT_CONFIG.overlayBorderWidth),
    overlayBorderColor: DEFAULT_CHAT_CONFIG.overlayBorderColor,
    highlightTwitchEvents: DEFAULT_CHAT_CONFIG.highlightTwitchEvents,
    eventColorOpacity: String(DEFAULT_CHAT_CONFIG.eventColorOpacity),
    eventColors: { ...DEFAULT_EVENT_COLORS },
    twitchEventBold: DEFAULT_CHAT_CONFIG.twitchEventBold,
    twitchEventItalic: DEFAULT_CHAT_CONFIG.twitchEventItalic,
    showHighlightedMessages: DEFAULT_CHAT_CONFIG.showHighlightedMessages,
    showChannelPointRewards: DEFAULT_CHAT_CONFIG.showChannelPointRewards,
    showGigantifiedEmotes: DEFAULT_CHAT_CONFIG.showGigantifiedEmotes,
    showPredictions: DEFAULT_CHAT_CONFIG.showPredictions,
    linkMode: DEFAULT_CHAT_CONFIG.linkMode,
    linkColor: DEFAULT_CHAT_CONFIG.linkColor,
    usersColorEnabled: false,
    usersColor: "#ffffff",
    hideLinkRewards: DEFAULT_CHAT_CONFIG.hideLinkRewards,
    rteProxy: DEFAULT_CHAT_CONFIG.rteProxy,
    rteAzureTts: DEFAULT_CHAT_CONFIG.rteAzureTts,
    rteChatIsTts: DEFAULT_CHAT_CONFIG.rteChatIsTts,
    rteReyohohoBadge: DEFAULT_CHAT_CONFIG.rteReyohohoBadge,
    rteCustomCosmetics: DEFAULT_CHAT_CONFIG.rteCustomCosmetics,
    ...overrides,
  };
}

test("a default form projects the default config", () => {
  expect(buildSetupConfig(createForm(), "somechannel")).toEqual({
    ...DEFAULT_CHAT_CONFIG,
    channel: "somechannel",
  });
});

test("buildSetupConfig trims and de-channels the secondary platforms", () => {
  const config = buildSetupConfig(
    createForm({ youtubeChannel: "  @SomeYouTube  ", kickChannel: "@SomeKick" }),
    "twitchchannel",
  );

  expect(config.youtubeChannel).toBe("SomeYouTube");
  expect(config.kickChannel).toBe("SomeKick");
  expect(config.channel).toBe("twitchchannel");
});

test("buildSetupConfig coerces out-of-range and malformed form input", () => {
  const config = buildSetupConfig(
    createForm({
      lineHeight: "900",
      fontWeight: "abc",
      messageSpeed: "-40",
      shadow: "0",
      stroke: "6",
      fade: "-1",
      emoteScale: "oops",
      overlayBackgroundColor: "not-a-colour",
      overlayBorderColor: "#11223380",
      linkColor: "#AABBCC",
      usersColorEnabled: true,
      usersColor: "#00ff00",
      botNames: [" Alpha ", "BETA"],
      allowedChatters: ["Viewer"],
    }),
    "c",
  );

  expect(config.lineHeight).toBe(200);
  expect(config.fontWeight).toBe(DEFAULT_CHAT_CONFIG.fontWeight);
  expect(config.messageSpeed).toBe(MIN_MESSAGE_SPEED);
  expect(config.shadow).toBe(false);
  expect(config.stroke).toBe(6);
  expect(config.fade).toBe(false);
  expect(config.emoteScale).toBe(DEFAULT_CHAT_CONFIG.emoteScale);
  expect(config.overlayBackgroundColor).toBe(
    DEFAULT_CHAT_CONFIG.overlayBackgroundColor,
  );
  expect(config.overlayBorderColor).toBe("#11223380");
  expect(config.linkColor).toBe("#AABBCC");
  expect(config.usersColor).toBe("#00ff00");
  expect(config.botNames).toBe("alpha,beta");
  expect(config.singleChatter).toBe("viewer");
});

test("bot lists are normalized but not de-duplicated by the projection", () => {
  // De-duplication is the chip list's job (mergeUniqueLogins); the projection
  // only normalizes, which is what the URL round trip relies on.
  const config = buildSetupConfig(
    createForm({ botNames: [" Alpha ", "BETA", "alpha"] }),
    "c",
  );
  expect(config.botNames).toBe("alpha,beta,alpha");
});

test("usersColor is cleared when the uniform nickname colour is off", () => {
  const config = buildSetupConfig(
    createForm({ usersColorEnabled: false, usersColor: "#00ff00" }),
    "c",
  );
  expect(config.usersColor).toBe("");
});

test("buildOverlayUrl keeps the message speed unless the preview asks otherwise", () => {
  const config = buildSetupConfig(createForm({ messageSpeed: "5" }), "chan");
  const base = { baseUrl: "https://example.test" };

  const exported = buildOverlayUrl(config, undefined, base);
  expect(exported.startsWith("https://example.test/chat/?")).toBe(true);
  expect(new URL(exported).searchParams.get("ms")).toBe("5");

  const preview = buildOverlayUrl(config, undefined, {
    ...base,
    includeMessageSpeed: false,
  });
  expect(new URL(preview).searchParams.get("ms")).toBeNull();
});

test("buildOverlayUrl lets extra params win over the projected config", () => {
  const config = buildSetupConfig(createForm(), "chan");
  const url = buildOverlayUrl(
    config,
    { preview: "true", c: "override" },
    { baseUrl: "https://example.test" },
  );
  const params = new URL(url).searchParams;

  expect(params.get("preview")).toBe("true");
  expect(params.get("c")).toBe("override");
});

test("the exported url round-trips through the overlay parser", () => {
  const config = buildSetupConfig(
    createForm({
      size: "3",
      font: "7",
      lineHeight: "170",
      fontWeight: "700",
      emoteScale: "1.4",
      gifScale: "0.8",
      fade: "12",
      shadow: "3",
      showGifs: true,
      horizontal: true,
      botNames: ["alpha"],
      kickBotNames: ["kickbot"],
      youtubeBotNames: ["ytbot"],
      allowedChatters: ["viewer"],
    }),
    "roundtrip",
  );

  const url = buildOverlayUrl(config, undefined, { baseUrl: "https://example.test" });
  const parsed = parseChatConfigFromSearchParams(new URL(url).searchParams);

  expect(parsed.channel).toBe("roundtrip");
  expect(parsed.size).toBe(3);
  expect(parsed.font).toBe(7);
  expect(parsed.lineHeight).toBe(170);
  expect(parsed.fontWeight).toBe(700);
  expect(parsed.emoteScale).toBe(1.4);
  expect(parsed.gifScale).toBe(0.8);
  expect(parsed.fade).toBe(12);
  expect(parsed.shadow).toBe(3);
  expect(parsed.showGifs).toBe(true);
  expect(parsed.horizontal).toBe(true);
  expect(parsed.botNames).toBe("alpha");
  expect(parsed.kickBotNames).toBe("kickbot");
  expect(parsed.youtubeBotNames).toBe("ytbot");
  expect(parsed.singleChatter).toBe("viewer");
});
