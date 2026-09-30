/**
 * Abuse policy for the public bridge: who may open how many sockets, how many
 * channels one client IP may subscribe to, and how fast. The numbers are
 * deliberately conservative for the overlay use case (one OBS browser source,
 * plus the setup preview) and every one of them is env-overridable.
 */
import {
  Budget,
  KeyCounter,
  RateLimiter,
  systemClock,
  type Clock,
  type RateLimitOptions,
} from "./limits";
import type { SourceCapacityIssue } from "./source-registry";

export type TrustProxyMode = "auto" | "always" | "never";

export type BridgeLimits = {
  /** Concurrent WebSockets from one client IP. */
  readonly maxConnectionsPerIp: number;
  /** Concurrent source subscriptions from one client IP. */
  readonly maxSourcesPerIp: number;
  /** Concurrent WebSockets across the whole bridge. */
  readonly maxConnections: number;
  /** Legacy `/c/` and `/s/` links start their own upstream sessions. */
  readonly maxLegacyConnections: number;
  /** Distinct channels the bridge follows at once. */
  readonly maxSources: number;
  /** Browser sources that may share one upstream channel. */
  readonly maxClientsPerSource: number;
  /** Hard cap on the raw channel identifier before platform rules apply. */
  readonly maxChannelNameLength: number;
  readonly upgradeRate: RateLimitOptions;
  readonly newSourceRate: RateLimitOptions;
  readonly globalNewSourceRate: RateLimitOptions;
  readonly searchRate: RateLimitOptions;
  readonly idleTimeoutSeconds: number;
  /**
   * `auto` (default) trusts forwarded headers only when the peer is a private
   * address, `always` trusts them from anywhere, `never` ignores them.
   */
  readonly trustProxy: TrustProxyMode;
  readonly allowedOrigins: readonly string[];
};

export type GuardDecision = {
  readonly allowed: boolean;
  readonly status: number;
  readonly code: string;
  readonly message: string;
  /** Seconds the client should wait before retrying; 0 when unknown. */
  readonly retryAfterSeconds: number;
};

export type BridgeLimitsEnv = Record<string, string | undefined>;

/** What a socket is about to consume, decided by the caller before the upgrade. */
export type SocketAdmission = {
  readonly kind: "legacy" | "source";
  /** True when this socket starts a new upstream worker. */
  readonly isNewWorker?: boolean;
  /** Registry verdict for the source, when the caller owns that state. */
  readonly capacityIssue?: SourceCapacityIssue | null;
};

/**
 * Defaults aim at real use: one OBS browser source plus the setup preview, on a
 * connection that may be shared (a household, an office, mobile carrier NAT).
 * They are generous for that shape and still bound what one client can burn.
 */
const DEFAULTS = {
  maxConnectionsPerIp: 32,
  maxSourcesPerIp: 16,
  maxConnections: 4096,
  maxLegacyConnections: 100,
  maxSources: 500,
  maxClientsPerSource: 200,
  maxChannelNameLength: 64,
  upgradesPerMinutePerIp: 120,
  newSourcesPerHourPerIp: 240,
  newSourcesPerMinute: 120,
  searchesPerMinutePerIp: 120,
  idleTimeoutSeconds: 120,
} as const;

const ALLOW: GuardDecision = {
  allowed: true,
  status: 200,
  code: "OK",
  message: "",
  retryAfterSeconds: 0,
};

function deny(
  status: number,
  code: string,
  message: string,
  retryAfterSeconds = 0,
): GuardDecision {
  return { allowed: false, status, code, message, retryAfterSeconds };
}

function readInt(
  env: BridgeLimitsEnv,
  name: string,
  fallback: number,
  minimum = 1,
  maximum = 1_000_000,
): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    console.warn(`[chat-sources] ignoring invalid ${name}="${raw}"`);
    return fallback;
  }
  return Math.min(parsed, maximum);
}

function readTrustProxy(env: BridgeLimitsEnv): TrustProxyMode {
  const raw = env.TRUST_PROXY?.trim().toLowerCase();
  if (!raw || raw === "auto") return "auto";
  if (["1", "true", "yes", "on"].includes(raw)) return "always";
  if (["0", "false", "no", "off"].includes(raw)) return "never";
  console.warn(`[chat-sources] ignoring invalid TRUST_PROXY="${raw}"`);
  return "auto";
}

function readList(env: BridgeLimitsEnv, name: string): readonly string[] {
  return (env[name] ?? "")
    .split(",")
    .map((entry) => entry.trim().replace(/\/+$/, "").toLowerCase())
    .filter(Boolean);
}

/** Burst is half a minute of the sustained rate, so a spike never exceeds 2x. */
function windowRule(actions: number, windowSeconds: number): RateLimitOptions {
  const refillPerSecond = actions / windowSeconds;
  return {
    capacity: Math.max(2, Math.ceil(refillPerSecond * 30)),
    refillPerSecond,
  };
}

export function resolveBridgeLimits(env: BridgeLimitsEnv = process.env): BridgeLimits {
  return {
    maxConnectionsPerIp: readInt(env, "MAX_CONNECTIONS_PER_IP", DEFAULTS.maxConnectionsPerIp),
    maxSourcesPerIp: readInt(env, "MAX_SOURCES_PER_IP", DEFAULTS.maxSourcesPerIp),
    maxConnections: readInt(env, "MAX_CONNECTIONS", DEFAULTS.maxConnections),
    maxLegacyConnections: readInt(env, "MAX_LEGACY_CONNECTIONS", DEFAULTS.maxLegacyConnections),
    maxSources: readInt(env, "MAX_SOURCES", DEFAULTS.maxSources),
    maxClientsPerSource: readInt(env, "MAX_CLIENTS_PER_SOURCE", DEFAULTS.maxClientsPerSource),
    maxChannelNameLength: readInt(env, "MAX_CHANNEL_NAME_LENGTH", DEFAULTS.maxChannelNameLength),
    upgradeRate: windowRule(
      readInt(env, "UPGRADES_PER_MINUTE_PER_IP", DEFAULTS.upgradesPerMinutePerIp),
      60,
    ),
    newSourceRate: windowRule(
      readInt(env, "NEW_SOURCES_PER_HOUR_PER_IP", DEFAULTS.newSourcesPerHourPerIp),
      3600,
    ),
    globalNewSourceRate: windowRule(
      readInt(env, "NEW_SOURCES_PER_MINUTE", DEFAULTS.newSourcesPerMinute),
      60,
    ),
    searchRate: windowRule(
      readInt(env, "SEARCHES_PER_MINUTE_PER_IP", DEFAULTS.searchesPerMinutePerIp),
      60,
    ),
    idleTimeoutSeconds: readInt(
      env,
      "WS_IDLE_TIMEOUT_SECONDS",
      DEFAULTS.idleTimeoutSeconds,
      10,
      3600,
    ),
    trustProxy: readTrustProxy(env),
    allowedOrigins: readList(env, "ALLOWED_ORIGINS"),
  };
}

/** Strips an IPv6-mapped prefix, brackets, and a port so one client is one key. */
export function normalizeClientIp(value: string | null | undefined): string {
  if (!value) return "unknown";
  let ip = value.trim().toLowerCase();
  if (ip.startsWith("[")) {
    const end = ip.indexOf("]");
    if (end > 0) ip = ip.slice(1, end);
  }
  if (ip.startsWith("::ffff:")) ip = ip.slice("::ffff:".length);
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(":"));
  return ip || "unknown";
}

function lastForwardedFor(value: string | null): string {
  if (!value) return "";
  const parts = value.split(",");
  return parts[parts.length - 1]?.trim() ?? "";
}

/** Loopback, link-local, and the RFC 1918 / ULA ranges a proxy lives in. */
export function isPrivateClientAddress(ip: string): boolean {
  if (!ip || ip === "unknown") return false;
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true;
  if (/^fe80:/.test(ip)) return true;

  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return false;
  const [first = -1, second = -1] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

export function hasForwardedHeaders(headers: Headers): boolean {
  return Boolean(
    headers.get("cf-connecting-ip") ||
      headers.get("x-real-ip") ||
      headers.get("x-forwarded-for"),
  );
}

/**
 * The socket address is the real peer unless a proxy sits in front. `auto`
 * (the default) trusts the forwarded chain only when the peer is a private
 * address, which is where a load balancer or an in-cluster ingress connects
 * from; a public peer means a direct client, whose headers are its own claims.
 * `always`/`never` force the decision.
 *
 * The chain is read right-to-left (`cf-connecting-ip`, then `x-real-ip`, then
 * the last `x-forwarded-for` entry): every proxy appends the peer it saw, so
 * earlier entries are client-controlled.
 */
export function resolveClientIp(
  headers: Headers,
  socketAddress: string | undefined,
  trustProxy: TrustProxyMode,
): string {
  const peer = normalizeClientIp(socketAddress);
  if (!trustsForwardedHeaders(peer, trustProxy)) return peer;

  const forwarded =
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    lastForwardedFor(headers.get("x-forwarded-for"));
  return forwarded ? normalizeClientIp(forwarded) : peer;
}

export function trustsForwardedHeaders(
  socketAddress: string | undefined,
  trustProxy: TrustProxyMode,
): boolean {
  if (trustProxy === "always") return true;
  if (trustProxy === "never") return false;
  return isPrivateClientAddress(normalizeClientIp(socketAddress));
}

/**
 * An empty list allows every origin (the default, so OBS and self-hosted pages
 * keep working). A configured list only gates requests that actually carry an
 * origin, because the point is stopping other sites from spending a visitor's
 * browser, not authenticating scripts.
 */
export function isOriginAllowed(origin: string | null, allowed: readonly string[]): boolean {
  if (allowed.length === 0 || allowed.includes("*")) return true;
  if (!origin) return true;
  return allowed.includes(origin.trim().replace(/\/+$/, "").toLowerCase());
}

export class SourceGuard {
  private readonly connections = new KeyCounter();
  private readonly sources = new KeyCounter();
  private readonly legacy: Budget;
  private readonly upgrades: RateLimiter;
  private readonly newSources: RateLimiter;
  private readonly globalNewSources: RateLimiter;
  private readonly searches: RateLimiter;

  constructor(
    readonly limits: BridgeLimits,
    now: Clock = systemClock,
  ) {
    this.legacy = new Budget(limits.maxLegacyConnections);
    this.upgrades = new RateLimiter(limits.upgradeRate, now);
    this.newSources = new RateLimiter(limits.newSourceRate, now);
    this.globalNewSources = new RateLimiter(limits.globalNewSourceRate, now);
    this.searches = new RateLimiter(limits.searchRate, now);
  }

  checkOrigin(origin: string | null): GuardDecision {
    if (isOriginAllowed(origin, this.limits.allowedOrigins)) return ALLOW;
    return deny(403, "ORIGIN_NOT_ALLOWED", "This origin may not use the bridge");
  }

  checkUpgrade(ip: string): GuardDecision {
    return this.fromRateLimit(this.upgrades.take(ip), "RATE_LIMITED", "Too many connection attempts");
  }

  /**
   * Reserves every slot a socket needs. The caller releases with `release` when
   * the socket closes, or immediately when the upgrade fails.
   */
  admit(ip: string, admission: SocketAdmission): GuardDecision {
    if (this.connections.total >= this.limits.maxConnections) {
      return deny(503, "BRIDGE_BUSY", "The bridge is at capacity, try again shortly", 5);
    }
    if (this.connections.count(ip) >= this.limits.maxConnectionsPerIp) {
      return deny(
        429,
        "TOO_MANY_CONNECTIONS",
        `At most ${this.limits.maxConnectionsPerIp} connections per client`,
        10,
      );
    }

    if (admission.kind === "legacy") {
      if (!this.legacy.reserve()) {
        return deny(503, "BRIDGE_BUSY", "The bridge is at capacity, try again shortly", 5);
      }
      this.connections.add(ip);
      return ALLOW;
    }

    if (admission.capacityIssue === "source_limit") {
      return deny(503, "BRIDGE_BUSY", "The bridge is following as many channels as it can", 10);
    }
    if (admission.capacityIssue === "client_limit") {
      return deny(
        503,
        "SOURCE_BUSY",
        "This channel already has as many viewers as the bridge will serve",
        10,
      );
    }
    if (this.sources.count(ip) >= this.limits.maxSourcesPerIp) {
      return deny(
        429,
        "TOO_MANY_SOURCES",
        `At most ${this.limits.maxSourcesPerIp} channel subscriptions per client`,
        30,
      );
    }

    if (admission.isNewWorker) {
      const perIp = this.newSources.take(ip);
      if (!perIp.allowed) {
        return this.fromRateLimit(perIp, "RATE_LIMITED", "Too many new channel subscriptions");
      }
      const global = this.globalNewSources.take("global");
      if (!global.allowed) {
        return deny(503, "BRIDGE_BUSY", "The bridge is starting too many channels", 10);
      }
    }

    this.connections.add(ip);
    this.sources.add(ip);
    return ALLOW;
  }

  release(ip: string, kind: SocketAdmission["kind"]): void {
    this.connections.remove(ip);
    if (kind === "legacy") this.legacy.release();
    else this.sources.remove(ip);
  }

  checkSearch(ip: string): GuardDecision {
    return this.fromRateLimit(this.searches.take(ip), "RATE_LIMITED", "Too many search requests");
  }

  prune(): void {
    this.upgrades.prune();
    this.newSources.prune();
    this.globalNewSources.prune();
    this.searches.prune();
  }

  get activeConnections(): number {
    return this.connections.total;
  }

  get activeSources(): number {
    return this.sources.total;
  }

  private fromRateLimit(
    result: { allowed: true } | { allowed: false; retryAfterSeconds: number },
    code: string,
    message: string,
  ): GuardDecision {
    if (result.allowed) return ALLOW;
    return deny(429, code, message, result.retryAfterSeconds);
  }
}
