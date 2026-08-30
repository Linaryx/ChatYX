import { describe, expect, test } from "bun:test";
import { adaptRteProxyUrl } from "../src/services/chat/rteProxy";

const RTE_PROXY_BASE = "https://ext.rte.net.ru:8443/";

describe("RTE proxy URL adapter", () => {
  test("returns the original URL when the adapter is disabled", () => {
    const target = "https://7tv.io/v3/emote-sets/global?limit=1";

    expect(adaptRteProxyUrl(target, false)).toBe(target);
  });

  test("proxies only the hardcoded public provider hosts", () => {
    const targets = [
      "https://7tv.io/v3/emote-sets/global",
      "https://cdn.7tv.app/emote/1/3x.webp",
      "https://api.betterttv.net/3/cached/emotes/global",
      "https://cdn.betterttv.net/emote/1/3x",
      "https://api.frankerfacez.com/v1/set/global",
      "https://cdn.frankerfacez.com/emoticon/1/4",
      "https://api.ffzap.com/v1/supporters",
    ];

    expect(targets.map((target) => adaptRteProxyUrl(target, true))).toEqual(
      targets.map((target) => `${RTE_PROXY_BASE}${target}`),
    );
  });

  test("never proxies lookalikes, credentials, ports, or non-HTTPS URLs", () => {
    const rejected = [
      "https://gql.twitch.tv/gql",
      "https://7tv.io.evil.example/data",
      "https://sub.7tv.io/data",
      "https://user:secret@7tv.io/data",
      "https://7tv.io:9443/data",
      "http://7tv.io/data",
      "not a URL",
    ];

    expect(rejected.map((target) => adaptRteProxyUrl(target, true))).toEqual(
      rejected,
    );
  });
});
