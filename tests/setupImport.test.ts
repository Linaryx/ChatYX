import { describe, expect, test } from "bun:test";
import { parseSetupImport } from "../src/config/setupImport";

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

  test("keeps Davii detection and label separate while sharing schema mapping", () => {
    // Given
    const input =
      "https://unificado.justdavi.dev/?channel=foo&font=Custom%20Face&size=3";

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
    const chatIsInput = "channel=foo&markdown=true&md_image=x&last_emote_background=true&future=1";
    const cyanInput =
      "channel=foo&big_emotes=true&link_urls=true&center=true&height=4&hide_paints=true&hide_colon=true&future=1";

    // When
    const chatIsResult = parseSetupImport(chatIsInput, "chatis");
    const cyanResult = parseSetupImport(cyanInput, "cyan");

    // Then
    expect(chatIsResult.kind === "parsed" ? chatIsResult.unsupported : []).toEqual([
      "markdown",
      "md_image",
      "last_emote_background",
    ]);
    expect(cyanResult.kind === "parsed" ? cyanResult.unsupported : []).toEqual([
      "big_emotes",
      "link_urls",
      "center",
      "height",
      "hide_paints",
      "hide_colon",
    ]);
  });
});
