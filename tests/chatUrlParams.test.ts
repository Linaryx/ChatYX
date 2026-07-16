import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CHAT_CONFIG,
  chatConfigToSearchParams,
  normalizeBotNames,
  parseChatConfigFromSearchParams,
  type ChatConfig,
} from "../src/config/chatUrlParams";

describe("chat URL params", () => {
  test("uses the hosted YouTube websocket by default", () => {
    expect(DEFAULT_CHAT_CONFIG.youtubeWebSocketUrl).toBe(
      "wss://ytwss.ruina.team",
    );
  });

  test("parses aliases and typed values", () => {
    const params = new URLSearchParams(
      "channel=forsen&yt=@someyt&ytws=ws://localhost:9905&s=2&fw=700&nfw=900&sh=0&fd=0&a=false&ms=91&rm=false&b=false&cmd=false&es=1.5&sg=someuser&u7=false",
    );

    const cfg = parseChatConfigFromSearchParams(params);

    expect(cfg.channel).toBe("forsen");
    expect(cfg.youtubeChannel).toBe("@someyt");
    expect(cfg.youtubeWebSocketUrl).toBe("ws://localhost:9905");
    expect(cfg.size).toBe(2);
    expect(cfg.fontWeight).toBe(700);
    expect(cfg.nickFontWeight).toBe(900);
    expect(cfg.shadow).toBe(false);
    expect(cfg.fade).toBe(false);
    expect(cfg.animation).toBe("none");
    expect(cfg.messageSpeed).toBe(91);
    expect(cfg.recentMessages).toBe(false);
    expect(cfg.bots).toBe(false);
    expect(cfg.commands).toBe(false);
    expect(cfg.emoteScale).toBe(1.5);
    expect(cfg.singleChatter).toBe("someuser");
    expect(cfg.show7tvUnlisted).toBe(false);
  });

  test("serializes non-defaults and round-trips", () => {
    const cfg: ChatConfig = {
      ...DEFAULT_CHAT_CONFIG,
      channel: "xqc",
      youtubeChannel: "someyt",
      youtubeWebSocketUrl: "ws://localhost:9905",
      bots: false,
      fade: false,
      recentMessages: false,
      shadow: false,
      fontWeight: 700,
      nickFontWeight: 900,
      messageSpeed: 72,
      animation: "scroll",
      emoteScale: 1.25,
      twitchEventColor: "#ff00ff",
      twitchEventBackgroundOpacity: 35,
      twitchEventBold: false,
      twitchEventItalic: true,
      showHighlightedMessages: false,
      showChannelPointRewards: false,
      showGigantifiedEmotes: false,
      linkMode: "highlight",
      linkColor: "#00ccff",
      hideLinkRewards: false,
      botNames: normalizeBotNames("Nightbot, StreamElements"),
    };

    const params = chatConfigToSearchParams(cfg);

    expect(params.get("c")).toBe("xqc");
    expect(params.get("yt")).toBe("someyt");
    expect(params.get("ytws")).toBe("ws://localhost:9905");
    expect(params.get("b")).toBe("false");
    expect(params.get("fd")).toBe("0");
    expect(params.get("rm")).toBe("false");
    expect(params.get("sh")).toBe("0");
    expect(params.get("fw")).toBe("700");
    expect(params.get("nfw")).toBe("900");
    expect(params.get("ms")).toBe("72");
    expect(params.get("an")).toBe("scroll");
    expect(params.get("es")).toBe("1.25");
    expect(params.get("tec")).toBe("#ff00ff");
    expect(params.get("teo")).toBe("35");
    expect(params.get("teb")).toBe("false");
    expect(params.get("tei")).toBe("true");
    expect(params.get("hl")).toBe("false");
    expect(params.get("rewards")).toBe("false");
    expect(params.get("gigantify")).toBe("false");
    expect(params.get("links")).toBe("highlight");
    expect(params.get("linkcolor")).toBe("#00ccff");
    expect(params.get("hidelinkrewards")).toBe("false");
    expect(params.get("bn")).toBe("nightbot,streamelements");

    expect(parseChatConfigFromSearchParams(params)).toEqual(cfg);
  });

  test("treats botNames without explicit bots flag as a hide-list", () => {
    const cfg = parseChatConfigFromSearchParams(
      new URLSearchParams("bn=moobot,twirapp,nightbot"),
    );

    expect(cfg.botNames).toBe("moobot,twirapp,nightbot");
    expect(cfg.bots).toBe(false);
  });

  test("keeps explicit bots flag authoritative when botNames is present", () => {
    const cfg = parseChatConfigFromSearchParams(
      new URLSearchParams("b=true&bn=moobot,twirapp,nightbot"),
    );

    expect(cfg.bots).toBe(true);
  });

  test("supports animation modes and legacy animate links", () => {
    expect(
      parseChatConfigFromSearchParams(new URLSearchParams("an=flow")).animation,
    ).toBe("flow");
    expect(
      parseChatConfigFromSearchParams(new URLSearchParams("a=true")).animation,
    ).toBe("fade");
    expect(
      parseChatConfigFromSearchParams(new URLSearchParams("a=false")).animation,
    ).toBe("none");
    expect(
      parseChatConfigFromSearchParams(new URLSearchParams("an=unknown")).animation,
    ).toBe("fade");
  });

  test("falls back from unsupported link modes", () => {
    expect(
      parseChatConfigFromSearchParams(new URLSearchParams("links=invalid"))
        .linkMode,
    ).toBe("normal");
  });
});
