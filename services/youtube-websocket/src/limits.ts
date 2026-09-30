/**
 * Dependency-free primitives behind the bridge's abuse limits. Each one keeps
 * its own state and takes an injected clock, so the policy layer above stays
 * testable without timers.
 */

export type Clock = () => number;

export const systemClock: Clock = () => Date.now();

export type RateLimitOptions = {
  /** Burst size: how many actions may happen back to back. */
  readonly capacity: number;
  /** Sustained rate, in actions per second. */
  readonly refillPerSecond: number;
  /** Buckets untouched for this long are dropped by `prune`. */
  readonly idleTtlMs?: number;
};

export type RateLimitResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

const DEFAULT_IDLE_TTL_MS = 10 * 60_000;

type Bucket = {
  tokens: number;
  updatedAt: number;
};

/**
 * Token bucket per key. A key starts with a full bucket, spends one token per
 * `take`, and refills continuously, which keeps a reconnect loop cheap while a
 * burst still hits the ceiling.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly idleTtlMs: number;

  constructor(
    private readonly options: RateLimitOptions,
    private readonly now: Clock = systemClock,
  ) {
    this.idleTtlMs = options.idleTtlMs ?? DEFAULT_IDLE_TTL_MS;
  }

  take(key: string): RateLimitResult {
    const now = this.now();
    const capacity = Math.max(1, this.options.capacity);
    const bucket = this.buckets.get(key);
    if (!bucket) {
      this.buckets.set(key, { tokens: capacity - 1, updatedAt: now });
      return { allowed: true };
    }

    const refillPerSecond = Math.max(0, this.options.refillPerSecond);
    const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1000;
    const tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
    bucket.updatedAt = now;

    if (tokens < 1) {
      bucket.tokens = tokens;
      return { allowed: false, retryAfterSeconds: this.retryAfterSeconds(tokens, refillPerSecond) };
    }

    bucket.tokens = tokens - 1;
    return { allowed: true };
  }

  /** Drops keys that have been idle long enough to be back at full capacity. */
  prune(): void {
    const now = this.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt >= this.idleTtlMs) this.buckets.delete(key);
    }
  }

  get size(): number {
    return this.buckets.size;
  }

  private retryAfterSeconds(tokens: number, refillPerSecond: number): number {
    if (refillPerSecond <= 0) return 0;
    return Math.max(1, Math.ceil((1 - tokens) / refillPerSecond));
  }
}

/**
 * Concurrent counts per key with a cheap global total. The caller does the
 * enforcement; this only keeps the books straight.
 */
export class KeyCounter {
  private readonly counts = new Map<string, number>();

  add(key: string): number {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }

  remove(key: string): void {
    const current = this.counts.get(key);
    if (!current) return;
    if (current <= 1) this.counts.delete(key);
    else this.counts.set(key, current - 1);
  }

  count(key: string): number {
    return this.counts.get(key) ?? 0;
  }

  get total(): number {
    let total = 0;
    for (const count of this.counts.values()) total += count;
    return total;
  }

  get keys(): number {
    return this.counts.size;
  }

  reset(): void {
    this.counts.clear();
  }
}

/** Fixed number of slots, handed out one at a time. */
export class Budget {
  private used = 0;

  constructor(private readonly capacity: number) {}

  reserve(): boolean {
    if (this.used >= this.capacity) return false;
    this.used += 1;
    return true;
  }

  release(): void {
    if (this.used > 0) this.used -= 1;
  }

  get usedCount(): number {
    return this.used;
  }

  get limit(): number {
    return this.capacity;
  }
}
