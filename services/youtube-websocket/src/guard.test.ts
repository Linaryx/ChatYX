import { describe, expect, test } from "bun:test";
import {
  isOriginAllowed,
  normalizeClientIp,
  resolveBridgeLimits,
  resolveClientIp,
  SourceGuard,
  type BridgeLimits,
} from "./guard";

function testLimits(overrides: Partial<BridgeLimits> = {}): BridgeLimits {
  return {
    ...resolveBridgeLimits({}),
    maxConnectionsPerIp: 2,
    maxSourcesPerIp: 1,
    maxConnections: 100,
    maxLegacyConnections: 1,
    maxSources: 10,
    maxClientsPerSource: 10,
    maxChannelNameLength: 32,
    upgradeRate: { capacity: 2, refillPerSecond: 0 },
    newSourceRate: { capacity: 1, refillPerSecond: 0 },
    globalNewSourceRate: { capacity: 2, refillPerSecond: 0 },
    searchRate: { capacity: 1, refillPerSecond: 0 },
    idleTimeoutSeconds: 120,
    trustProxy: false,
    allowedOrigins: [],
    ...overrides,
  };
}

function fakeClock() {
  let now = 0;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("bridge limits config", () => {
  test("uses the documented defaults", () => {
    const limits = resolveBridgeLimits({});

    expect(limits.maxConnectionsPerIp).toBe(16);
    expect(limits.maxSourcesPerIp).toBe(8);
    expect(limits.maxSources).toBe(500);
    expect(limits.maxClientsPerSource).toBe(200);
    expect(limits.maxChannelNameLength).toBe(64);
    expect(limits.idleTimeoutSeconds).toBe(120);
    expect(limits.trustProxy).toBe(false);
    expect(limits.allowedOrigins).toEqual([]);
    expect(limits.upgradeRate.refillPerSecond).toBe(1);
  });

  test("reads overrides and ignores nonsense values", () => {
    const limits = resolveBridgeLimits({
      MAX_CONNECTIONS_PER_IP: "4",
      MAX_SOURCES: "25",
      UPGRADES_PER_MINUTE_PER_IP: "600",
      WS_IDLE_TIMEOUT_SECONDS: "nope",
      TRUST_PROXY: "yes",
      ALLOWED_ORIGINS: "https://example.com/, https://chat.example.com",
    });

    expect(limits.maxConnectionsPerIp).toBe(4);
    expect(limits.maxSources).toBe(25);
    expect(limits.upgradeRate.refillPerSecond).toBe(10);
    expect(limits.upgradeRate.capacity).toBe(300);
    expect(limits.idleTimeoutSeconds).toBe(120);
    expect(limits.trustProxy).toBe(true);
    expect(limits.allowedOrigins).toEqual(["https://example.com", "https://chat.example.com"]);
  });
});

describe("client address resolution", () => {
  test("normalizes mapped, bracketed, and ported addresses", () => {
    expect(normalizeClientIp("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(normalizeClientIp("[2001:DB8::1]:443")).toBe("2001:db8::1");
    expect(normalizeClientIp("203.0.113.7:1234")).toBe("203.0.113.7");
    expect(normalizeClientIp("")).toBe("unknown");
    expect(normalizeClientIp(undefined)).toBe("unknown");
  });

  test("prefers the socket address unless a proxy is trusted", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 198.51.100.9" });

    expect(resolveClientIp(headers, "203.0.113.7", false)).toBe("203.0.113.7");
    expect(resolveClientIp(headers, "203.0.113.7", true)).toBe("198.51.100.9");
  });

  test("accepts the dedicated proxy headers first", () => {
    const headers = new Headers({
      "cf-connecting-ip": "198.51.100.1",
      "x-forwarded-for": "1.2.3.4",
    });

    expect(resolveClientIp(headers, "127.0.0.1", true)).toBe("198.51.100.1");
  });
});

describe("origin allowlist", () => {
  test("allows everything when nothing is configured", () => {
    expect(isOriginAllowed("https://evil.example", [])).toBe(true);
    expect(isOriginAllowed(null, [])).toBe(true);
    expect(isOriginAllowed("https://evil.example", ["*"])).toBe(true);
  });

  test("matches configured origins and lets origin-less clients through", () => {
    const allowed = ["https://linaryx.github.io"];

    expect(isOriginAllowed("https://linaryx.github.io", allowed)).toBe(true);
    expect(isOriginAllowed("https://LINARYX.github.io/", allowed)).toBe(true);
    expect(isOriginAllowed("https://evil.example", allowed)).toBe(false);
    expect(isOriginAllowed(null, allowed)).toBe(true);
  });

  test("rejects a disallowed origin before anything else", () => {
    const guard = new SourceGuard(testLimits({ allowedOrigins: ["https://ok.example"] }));

    const denied = guard.checkOrigin("https://evil.example");
    expect(denied.allowed).toBe(false);
    expect(denied.status).toBe(403);
    expect(guard.checkOrigin("https://ok.example").allowed).toBe(true);
    expect(guard.checkOrigin(null).allowed).toBe(true);
  });
});

describe("SourceGuard admission", () => {
  test("caps concurrent connections per IP and frees the slot on release", () => {
    const guard = new SourceGuard(testLimits({ maxSourcesPerIp: 4 }));

    expect(guard.admit("a", { kind: "source" }).allowed).toBe(true);
    expect(guard.admit("a", { kind: "source" }).allowed).toBe(true);
    const third = guard.admit("a", { kind: "source" });
    expect(third.allowed).toBe(false);
    expect(third.status).toBe(429);
    expect(third.code).toBe("TOO_MANY_CONNECTIONS");

    guard.release("a", "source");
    expect(guard.admit("a", { kind: "source" }).allowed).toBe(true);
    expect(guard.activeConnections).toBe(2);
  });

  test("caps channel subscriptions per IP", () => {
    const guard = new SourceGuard(testLimits({ maxConnectionsPerIp: 8 }));

    expect(guard.admit("a", { kind: "source" }).allowed).toBe(true);
    const second = guard.admit("a", { kind: "source" });
    expect(second.allowed).toBe(false);
    expect(second.code).toBe("TOO_MANY_SOURCES");
    expect(guard.activeSources).toBe(1);
  });

  test("rate limits subscriptions that would start a new worker", () => {
    const guard = new SourceGuard(
      testLimits({ maxSourcesPerIp: 8, newSourceRate: { capacity: 1, refillPerSecond: 1 } }),
    );

    expect(guard.admit("a", { kind: "source", isNewWorker: true }).allowed).toBe(true);
    const second = guard.admit("a", { kind: "source", isNewWorker: true });
    expect(second.allowed).toBe(false);
    expect(second.code).toBe("RATE_LIMITED");
    expect(second.retryAfterSeconds).toBeGreaterThan(0);

    // Sharing an already running channel stays cheap.
    expect(guard.admit("a", { kind: "source", isNewWorker: false }).allowed).toBe(true);
  });

  test("holds a global ceiling on new workers and on connections", () => {
    const clock = fakeClock();
    const guard = new SourceGuard(
      testLimits({
        globalNewSourceRate: { capacity: 1, refillPerSecond: 1 },
        newSourceRate: { capacity: 1, refillPerSecond: 1 },
      }),
      clock.now,
    );

    expect(guard.admit("a", { kind: "source", isNewWorker: true }).allowed).toBe(true);
    const second = guard.admit("b", { kind: "source", isNewWorker: true });
    expect(second.allowed).toBe(false);
    expect(second.status).toBe(503);
    expect(second.code).toBe("BRIDGE_BUSY");

    clock.advance(1000);
    expect(guard.admit("b", { kind: "source", isNewWorker: true }).allowed).toBe(true);
  });

  test("rejects when the registry is out of capacity", () => {
    const guard = new SourceGuard(testLimits());

    const sourceLimit = guard.admit("a", { kind: "source", capacityIssue: "source_limit" });
    expect(sourceLimit.status).toBe(503);
    expect(sourceLimit.code).toBe("BRIDGE_BUSY");

    const clientLimit = guard.admit("a", { kind: "source", capacityIssue: "client_limit" });
    expect(clientLimit.status).toBe(503);
    expect(clientLimit.code).toBe("SOURCE_BUSY");
    expect(guard.activeConnections).toBe(0);
  });

  test("caps the global connection pool across IPs", () => {
    const guard = new SourceGuard(testLimits({ maxConnections: 1, maxConnectionsPerIp: 4 }));

    expect(guard.admit("a", { kind: "source" }).allowed).toBe(true);
    const second = guard.admit("b", { kind: "source" });
    expect(second.allowed).toBe(false);
    expect(second.status).toBe(503);
  });

  test("caps legacy connections separately", () => {
    const guard = new SourceGuard(testLimits());

    expect(guard.admit("a", { kind: "legacy" }).allowed).toBe(true);
    const second = guard.admit("b", { kind: "legacy" });
    expect(second.allowed).toBe(false);
    expect(second.code).toBe("BRIDGE_BUSY");

    guard.release("a", "legacy");
    expect(guard.admit("b", { kind: "legacy" }).allowed).toBe(true);
  });
});

describe("SourceGuard rate limits", () => {
  test("throttles upgrade attempts per IP", () => {
    const guard = new SourceGuard(testLimits());

    expect(guard.checkUpgrade("a").allowed).toBe(true);
    expect(guard.checkUpgrade("a").allowed).toBe(true);
    const third = guard.checkUpgrade("a");
    expect(third.allowed).toBe(false);
    expect(third.status).toBe(429);
    expect(guard.checkUpgrade("b").allowed).toBe(true);
  });

  test("throttles Kick search per IP", () => {
    const guard = new SourceGuard(testLimits());

    expect(guard.checkSearch("a").allowed).toBe(true);
    expect(guard.checkSearch("a").allowed).toBe(false);
    expect(guard.checkSearch("b").allowed).toBe(true);
  });
});
