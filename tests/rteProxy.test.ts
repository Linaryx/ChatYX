import { describe, expect, test } from "bun:test";
import {
  requestThroughRte,
  rewriteRteHttpUrl,
  setRteProxyEnabled,
} from "../src/services/network/rteProxyTransport";
import { networkClient } from "../src/services/network/networkClient";

const RTE_PROXY_BASE = "https://ext.rte.net.ru:8443/";

describe("RTE proxy transport", () => {
  test("returns the original URL when the adapter is disabled", () => {
    const target = "https://7tv.io/v3/emote-sets/global?limit=1";

    expect(rewriteRteHttpUrl(target, false)).toBe(target);
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

    expect(targets.map((target) => rewriteRteHttpUrl(target, true))).toEqual(
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

    expect(rejected.map((target) => rewriteRteHttpUrl(target, true))).toEqual(
      rejected,
    );
  });

  test("does not retry a failed proxy request against the original host", async () => {
    const target = "https://7tv.io/v3/emote-sets/global";
    const requested: string[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input) => {
      requested.push(String(input));
      return new Response(null, { status: 503 });
    }) as typeof fetch;

    try {
      const response = await requestThroughRte(target, undefined, true);

      expect(response.status).toBe(503);
      expect(requested).toEqual([`${RTE_PROXY_BASE}${target}`]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("does not fall back to the original host when the proxy rejects", async () => {
    const target = "https://7tv.io/v3/emote-sets/global";
    const requested: string[] = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input) => {
      requested.push(String(input));
      throw new Error("proxy unavailable");
    }) as typeof fetch;

    try {
      await expect(requestThroughRte(target, undefined, true)).rejects.toThrow(
        "proxy unavailable",
      );
      expect(requested).toEqual([`${RTE_PROXY_BASE}${target}`]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("uses the configured proxy state for eligible URLs", () => {
    const target = "https://7tv.io/v3/emote-sets/global";

    setRteProxyEnabled(true);
    try {
      expect(rewriteRteHttpUrl(target)).toBe(`${RTE_PROXY_BASE}${target}`);
    } finally {
      setRteProxyEnabled(false);
    }
  });

  test("required RTE routes reject unsupported hosts instead of going direct", async () => {
    await expect(
      networkClient.request("https://gql.twitch.tv/gql", {
        route: "rte-required",
      }),
    ).rejects.toThrow("RTE route is not available");
  });
});
