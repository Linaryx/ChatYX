import { describe, expect, test } from "bun:test";
import { parseSetupImport } from "../src/config/setupImport";
import { chatConfigToSearchParams, DEFAULT_CHAT_CONFIG, type ChatConfig } from "../src/config/chatUrlParams";
import { applySetupImport, type SetupImportSetters } from "../src/components/setup/setupImportAdapter";

const runtimeOnlyKeys = [
  "youtubeWebSocketUrl", "kickWebSocketUrl", "ffzBotMix", "ffzBotMixCustom", "ttsReadChat", "ttsReadBots",
  "ttsVoice", "ttsChatIsVoice", "ttsVolume", "ttsMaxLength",
];

function formSettings(config: ChatConfig) {
  return Object.fromEntries(Object.entries(config)
    .filter(([key]) => !runtimeOnlyKeys.includes(key))
    .map(([key, value]) => [key,
      key === "botNames" || key === "singleChatter" ? String(value).split(/[\s,]+/).filter(Boolean)
        : value,
    ]));
}

const nativeConfig: ChatConfig = {
  ...DEFAULT_CHAT_CONFIG,
  channel: "streamer", youtubeChannel: "video", kickChannel: "kickstreamer",
  size: 3, font: 0, fontCustom: "Comic Sans MS", fontWeight: 650, nickFontWeight: 450,
  shadow: false, stroke: 4, fade: false, animation: "flow", messageSpeed: 72,
  showHomies: false, recentMessages: false, bots: true, commands: false,
  hideSpecialBadges: true, emoteScale: 1.75, botNames: "nightbot,moobot",
  singleChatter: "alice,bob", show7tvUnlisted: false, smallCaps: true,
  nlAfterName: true, hideNames: true, reverseLineOrder: true, horizontal: true,
  ffzBotMixBroadcaster: true, ffzBotMixModerator: false, ffzBotMixVip: true,
  overlayBackgroundColor: "#123456", overlayBackgroundOpacity: 0,
  overlayBackgroundRadius: 0, overlayBorderOpacity: 75,
  highlightTwitchEvents: false, twitchEventColor: "#abcdef",
  twitchEventBackgroundOpacity: 0, twitchEventBold: false, twitchEventItalic: true,
  showHighlightedMessages: false, showChannelPointRewards: false,
  showGigantifiedEmotes: false, showPredictions: true,
  linkMode: "highlight", linkColor: "#fedcba", hideLinkRewards: false,
  rteProxy: true, rteAzureTts: true, rteChatIsTts: true,
  rteReyohohoBadge: true, rteCustomCosmetics: true,
  showGifs: true, gifScale: 1.6,
};

describe("native setup import", () => {
  test.each([
    "https://chat.ruina.team/chat",
    "https://chat.ruina.team/",
    "https://linaryx.github.io/ChatYX/chat",
  ])("roundtrips every form-backed setting from %s", (base) => {
    const result = parseSetupImport(`${base}?${chatConfigToSearchParams(nativeConfig)}`, "auto");
    expect(result).toEqual({
      kind: "parsed", source: "chatyx", sourceLabel: "ChatYX",
      patch: formSettings(nativeConfig), unsupported: [],
    });
  });

  test.each(["", "?"])("accepts explicit native raw queries prefixed with '%s'", (prefix) => {
    const result = parseSetupImport(`${prefix}${chatConfigToSearchParams(nativeConfig)}`, "chatyx");
    expect(result.kind === "parsed" && result.patch).toEqual(formSettings(nativeConfig));
  });

  test("allows an explicit native URL on an unknown host", () => {
    const result = parseSetupImport("https://self-hosted.example/chat?c=foo", "chatyx");
    expect(result.kind === "parsed" && result.patch.channel).toBe("foo");
  });

  test("trusts only the exact current origin, including its port and scheme", () => {
    const origin = "http://localhost:5173";
    const accepted = parseSetupImport(`${origin}/chat?c=foo`, "auto", origin);
    expect(accepted.kind === "parsed" && accepted.source).toBe("chatyx");
    for (const other of ["http://localhost:5174", "https://localhost:5173", "http://127.0.0.1:5173"]) {
      expect(parseSetupImport(`${other}/chat?c=foo`, "auto", origin)).toEqual({ kind: "unrecognized" });
    }
  });

  test.each(["c=foo", "yt=video", "channel=foo&size=2", "show_homies=false", "fontCustom=Example", "nfw=500&bgc=%23abcdef"])(
    "does not guess the source of raw settings: %s", (input) => {
      expect(parseSetupImport(input, "auto")).toEqual({ kind: "ambiguous" });
    },
  );

  test.each([
    "https://example.com/chat?c=foo",
    "https://constructor/chat?c=foo",
    "https://toString/chat?c=foo",
    "https://chat.ruina.team.evil.example/chat?c=foo",
    "https://chat.ruina.team@evil.example/chat?c=foo",
    "https://evil.example@chat.ruina.team/chat?c=foo",
    "https://ytwss.ruina.team/?c=foo",
    "https://linaryx.github.io/another-project/?c=foo",
    "https://linaryx.github.io/ChatYX-fake/?c=foo",
    "ftp://chat.ruina.team/chat?c=foo",
  ])("rejects unknown or misleading auto-detected URLs: %s", (input) => {
    expect(parseSetupImport(input, "auto")).toEqual({ kind: "unrecognized" });
  });

  test.each([
    "", "?", "not a query", "future=1", "c", "?nfw", "an=invalid", "links=invalid",
    "b=maybe", "fw=huge", "s=2oops", "es=NaN", "es=Infinity", "es=0x10", "s=", "s=1.5",
    "bgc=not-a-color", "c=%ZZ", "c=%E0%A4", "c=foo&broken", "c=foo&&s=2",
    "https://chat.ruina.team/", "https://chat.ruina.team/?future=1",
    "https://chat.ruina.team/?c=foo&rm=maybe", "https://[invalid/?c=foo",
    "javascript:alert(1)?c=foo", "https//example.com/?c=foo&b=true",
  ])("does not reset settings for malformed or unknown native input: %s", (input) => {
    expect(parseSetupImport(input, "chatyx")).toEqual({ kind: "unrecognized" });
  });

  test("uses native aliases, legacy animation, and parser normalization", () => {
    const result = parseSetupImport(
      "channel=foo&nickFontWeight=900&message_speed=999&animate=false&recent_messages=no&fontWeight=50&overlay_background_color=%23123456&rteProxy=on",
      "chatyx",
    );
    expect(result.kind === "parsed" && result.patch).toMatchObject({
      channel: "foo", nickFontWeight: 900, messageSpeed: 100, animation: "none",
      recentMessages: false, fontWeight: 100, overlayBackgroundColor: "#123456", rteProxy: true,
    });
  });

  test("applies every native field and restores omitted defaults over previous values", () => {
    const state: Record<string, unknown> = {};
    const setters = Object.fromEntries(Object.keys(formSettings(DEFAULT_CHAT_CONFIG)).map((key) => [
      key, (value: unknown) => { state[key] = value; },
    ])) as SetupImportSetters;

    for (const config of [nativeConfig, { ...DEFAULT_CHAT_CONFIG, channel: "next" }]) {
      const result = parseSetupImport(`https://chat.ruina.team/chat?${chatConfigToSearchParams(config)}`, "auto");
      expect(result.kind).toBe("parsed");
      if (result.kind !== "parsed") throw new Error("Expected native import");
      applySetupImport(result.patch, setters);
      const expected = Object.fromEntries(Object.entries(formSettings(config)).map(([key, value]) => [
        key, typeof value === "number" ? String(value)
          : ["fade", "shadow", "stroke"].includes(key) && value === false ? "0" : value,
      ]));
      expect(state).toEqual(expected);
    }
  });

  test("clears explicit empty lists and channels rather than keeping old values", () => {
    const result = parseSetupImport("c=&yt=&kick=&bn=&sg=&fc=", "chatyx");
    expect(result.kind === "parsed" && result.patch).toMatchObject({
      channel: "", youtubeChannel: "", kickChannel: "", botNames: [], singleChatter: [], fontCustom: "",
    });
  });

  test("reports non-default runtime-only settings instead of pretending to restore them", () => {
    const result = parseSetupImport("c=foo&ytws=wss%3A%2F%2Fexample.com&kickws=wss%3A%2F%2Fkick.example.com&ttsread=true&fm=2&fmc=false", "chatyx");
    expect(result.kind).toBe("parsed");
    if (result.kind !== "parsed") throw new Error("Expected native import");
    expect(result.unsupported).toEqual(["youtubeWebSocketUrl", "kickWebSocketUrl", "ffzBotMix", "ffzBotMixCustom", "ttsReadChat"]);
    for (const key of runtimeOnlyKeys) expect(result.patch).not.toHaveProperty(key);
  });

  test("external imports remain partial when applied after native settings", () => {
    const calls: Record<string, unknown> = {};
    const setters = Object.fromEntries(Object.keys(formSettings(DEFAULT_CHAT_CONFIG)).map((key) => [
      key, (value: unknown) => { calls[key] = value; },
    ])) as SetupImportSetters;
    const result = parseSetupImport("https://chat.johnnycyan.com/?channel=foo&animate=false", "auto");
    if (result.kind !== "parsed") throw new Error("Expected Cyan import");
    applySetupImport(result.patch, setters);
    expect(calls).toEqual({ channel: "foo", animation: "none" });
  });
});

describe("setup import parser", () => {
  test("detects ChatIS URLs and maps supported appearance and behavior settings", () => {
    // Given
    const input =
      "https://chatis.is2511.com/v2/?channel=Foo&animate=false&bots=true&hide_special_badges=true&show_homies=false&fade=45&size=3&font=0&fontCustom=Comic%20Sans%20MS&stroke=2&shadow=3&emoteScale=1.5&small_caps=true&nl_after_name=true&hide_names=true&botNames=NightBot,nightbot,Moobot&reverse_line_order=true&horizontal=false&single_chatter=Viewer,viewer&show_7tv_unlisted=false";

    // When
    const result = parseSetupImport(input, "auto");

    // Then
    expect(result).toEqual({
      kind: "parsed",
      source: "chatis",
      sourceLabel: "ChatIS",
      patch: {
        channel: "foo",
        animation: "none",
        bots: true,
        hideSpecialBadges: true,
        showHomies: false,
        fade: 45,
        size: 3,
        font: 0,
        fontCustom: "Comic Sans MS",
        stroke: 2,
        shadow: 3,
        emoteScale: 1.5,
        smallCaps: true,
        nlAfterName: true,
        hideNames: true,
        botNames: ["nightbot", "moobot"],
        reverseLineOrder: true,
        horizontal: false,
        singleChatter: ["viewer"],
        show7tvUnlisted: false,
      },
      unsupported: [],
    });
  });

  test("detects Cyan URLs and converts shared schema values", () => {
    // Given
    const input =
      "https://chat.johnnycyan.com/?channel=Foo&yt=@Video&animate=true&bots=false&hide_commands=true&hide_badges=true&fade=0&size=0&font=SegoeUI&weight=4&stroke=1&shadow=2&small_caps=false&emoteScale=2&highlight=false&gigantify=true&show_redeems=false&allow=Alice,alice,BOB";

    // When
    const result = parseSetupImport(input, "auto");

    // Then
    expect(result).toEqual({
      kind: "parsed",
      source: "cyan",
      sourceLabel: "Cyan Chat",
      patch: {
        channel: "foo",
        youtubeChannel: "video",
        animation: "fade",
        bots: false,
        commands: false,
        hideSpecialBadges: true,
        fade: false,
        size: 1,
        font: 2,
        fontWeight: 800,
        stroke: 1,
        shadow: 2,
        smallCaps: false,
        emoteScale: 2,
        showHighlightedMessages: false,
        showGigantifiedEmotes: true,
        showChannelPointRewards: false,
        singleChatter: ["alice", "bob"],
      },
      unsupported: [],
    });
  });

  test("converts cyan weight presets, raw weights, and cyan-only fonts", () => {
    // Given
    const preset = parseSetupImport("weight=2", "cyan");
    const clamped = parseSetupImport("weight=50", "cyan");
    const raw = parseSetupImport("weight=700", "cyan");
    const invalid = parseSetupImport("weight=0", "cyan");
    const numericFont = parseSetupImport("font=10", "davii");
    const namedFont = parseSetupImport("font=Wallpoet", "cyan");

    // Then
    expect(preset.kind === "parsed" ? preset.patch.fontWeight : undefined).toBe(400);
    expect(clamped.kind === "parsed" ? clamped.patch.fontWeight : undefined).toBe(1000);
    expect(raw.kind === "parsed" ? raw.patch.fontWeight : undefined).toBe(700);
    expect(invalid).toEqual({ kind: "unrecognized" });
    expect(numericFont.kind === "parsed" ? numericFont.patch : undefined).toEqual({
      font: 0,
      fontCustom: "Press Start 2P",
    });
    expect(namedFont.kind === "parsed" ? namedFont.patch : undefined).toEqual({
      font: 0,
      fontCustom: "Wallpoet",
    });
  });

  test("applies ChatIS preset ranges and Cyan preset clamping", () => {
    // Given
    const chatIsOutOfRange = parseSetupImport("channel=foo&stroke=9&shadow=7", "chatis");
    const chatIsDisabled = parseSetupImport("channel=foo&stroke=0&shadow=0", "chatis");
    const cyanClamped = parseSetupImport("channel=foo&stroke=5&shadow=9", "cyan");

    // Then
    expect(chatIsOutOfRange.kind === "parsed" ? chatIsOutOfRange.patch : undefined).toEqual({
      channel: "foo",
    });
    expect(chatIsDisabled.kind === "parsed" ? chatIsDisabled.patch : undefined).toEqual({
      channel: "foo",
      stroke: false,
      shadow: false,
    });
    expect(cyanClamped.kind === "parsed" ? cyanClamped.patch : undefined).toEqual({
      channel: "foo",
      stroke: 2,
      shadow: 3,
    });
  });

  test.each([
    "https://unificado.justdavi.dev/",
    "https://chatsemban.justdavi.dev/",
  ])("keeps Davii detection and label separate while sharing schema mapping: %s", (base) => {
    // Given
    const input = `${base}?channel=foo&font=Custom%20Face&size=3`;

    // When
    const result = parseSetupImport(input, "auto");

    // Then
    expect(result).toEqual({
      kind: "parsed",
      source: "davii",
      sourceLabel: "Davii Chat",
      patch: { channel: "foo", font: 0, fontCustom: "Custom Face", size: 3 },
      unsupported: [],
    });
  });

  test("requires an explicit source for an ambiguous raw shared query", () => {
    // Given
    const input = "size=2&font=1&shadow=2";

    // When
    const result = parseSetupImport(input, "auto");

    // Then
    expect(result).toEqual({ kind: "ambiguous" });
  });

  test("uses explicit source selection without host detection", () => {
    // Given
    const input = "https://example.com/?size=2&font=1&weight=3";

    // When
    const result = parseSetupImport(input, "davii");

    // Then
    expect(result).toEqual({
      kind: "parsed",
      source: "davii",
      sourceLabel: "Davii Chat",
      patch: { size: 2, font: 2, fontWeight: 600 },
      unsupported: [],
    });
  });

  test("skips malformed values without throwing", () => {
    // Given
    const inputs = ["", "not a query", "https://chatis.is2511.com/?animate=maybe&size=huge"];

    // When
    const results = inputs.map((input) => parseSetupImport(input, "auto"));

    // Then
    expect(results).toEqual([
      { kind: "unrecognized" },
      { kind: "unrecognized" },
      { kind: "unrecognized" },
    ]);
  });

  test("reports known non-equivalent fields and ignores unknown fields", () => {
    // Given
    const chatIsInput = "channel=foo&markdown=true&md_image=x&last_emote_background=true&dynamicEmoteScale=true&desRegular=1.2&future=1";
    const cyanInput =
      "channel=foo&big_emotes=true&link_urls=true&center=true&height=4&hide_paints=true&hide_colon=true&filters=x&pronouns=true&pi_sides=left&future=1";

    // When
    const chatIsResult = parseSetupImport(chatIsInput, "chatis");
    const cyanResult = parseSetupImport(cyanInput, "cyan");

    // Then
    expect(chatIsResult.kind === "parsed" ? chatIsResult.unsupported : []).toEqual([
      "markdown",
      "md_image",
      "last_emote_background",
      "dynamicEmoteScale",
      "desRegular",
    ]);
    expect(cyanResult.kind === "parsed" ? cyanResult.unsupported : []).toEqual([
      "big_emotes",
      "link_urls",
      "center",
      "height",
      "hide_paints",
      "hide_colon",
      "pronouns",
      "filters",
      "pi_sides",
    ]);
  });

  test.each([
    ["none", "none"],
    ["badge", "icon"],
    ["minimal", "stripe"],
    ["outline", "stripe"],
  ] as const)("maps Cyan platform indicator %s to %s", (input, expected) => {
    const result = parseSetupImport(`channel=foo&platform_indicator=${input}`, "cyan");
    expect(result.kind === "parsed" ? result.patch : undefined).toEqual({
      channel: "foo",
      platformMarker: expected,
    });
  });

  test("reports an unknown Cyan platform indicator instead of ignoring it", () => {
    const result = parseSetupImport("channel=foo&platform_indicator=rainbow", "cyan");
    expect(result.kind === "parsed" ? result.unsupported : undefined).toEqual(["platform_indicator"]);
  });
});
