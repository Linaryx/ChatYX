import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CHAT_CONFIG,
  chatConfigToSearchParams,
  normalizeBotNames,
  parseChatConfigFromSearchParams,
  type ChatConfig,
} from "../src/config/chatUrlParams";

describe("chat URL params", () => {
  test("parses aliases and typed values", () => {
    const params = new URLSearchParams(
      "channel=forsen&s=2&sh=0&fd=0&a=false&ms=91&rm=false&b=false&cmd=false&es=1.5&sg=someuser&u7=false",
    );

    const cfg = parseChatConfigFromSearchParams(params);

    expect(cfg.channel).toBe("forsen");
    expect(cfg.size).toBe(2);
    expect(cfg.shadow).toBe(false);
    expect(cfg.fade).toBe(false);
    expect(cfg.animate).toBe(false);
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
      bots: false,
      fade: false,
      recentMessages: false,
      shadow: false,
      messageSpeed: 72,
      emoteScale: 1.25,
      botNames: normalizeBotNames("Nightbot, StreamElements"),
    };

    const params = chatConfigToSearchParams(cfg);

    expect(params.get("c")).toBe("xqc");
    expect(params.get("b")).toBe("false");
    expect(params.get("fd")).toBe("0");
    expect(params.get("rm")).toBe("false");
    expect(params.get("sh")).toBe("0");
    expect(params.get("ms")).toBe("72");
    expect(params.get("es")).toBe("1.25");
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
});
