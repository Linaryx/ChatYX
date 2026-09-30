import { describe, expect, test } from "bun:test";
import { Budget, KeyCounter, RateLimiter } from "./limits";

function fakeClock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("RateLimiter", () => {
  test("allows a burst up to capacity and then refuses", () => {
    const limiter = new RateLimiter({ capacity: 3, refillPerSecond: 0 });

    expect(limiter.take("ip").allowed).toBe(true);
    expect(limiter.take("ip").allowed).toBe(true);
    expect(limiter.take("ip").allowed).toBe(true);
    expect(limiter.take("ip").allowed).toBe(false);
  });

  test("refills over time and reports retry-after", () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ capacity: 2, refillPerSecond: 1 }, clock.now);

    expect(limiter.take("ip").allowed).toBe(true);
    expect(limiter.take("ip").allowed).toBe(true);
    const refused = limiter.take("ip");
    expect(refused.allowed).toBe(false);
    if (refused.allowed) throw new Error("expected refusal");
    expect(refused.retryAfterSeconds).toBe(1);

    clock.advance(1000);
    expect(limiter.take("ip").allowed).toBe(true);
  });

  test("keeps keys independent", () => {
    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 0 });

    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("b").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(false);
  });

  test("drops buckets once they are idle long enough", () => {
    const clock = fakeClock();
    const limiter = new RateLimiter(
      { capacity: 1, refillPerSecond: 0, idleTtlMs: 1000 },
      clock.now,
    );

    expect(limiter.take("ip").allowed).toBe(true);
    clock.advance(1500);
    limiter.prune();
    expect(limiter.size).toBe(0);

    expect(limiter.take("ip").allowed).toBe(true);
  });
});

describe("KeyCounter", () => {
  test("tracks per-key counts and a global total", () => {
    const counter = new KeyCounter();

    counter.add("a");
    counter.add("a");
    counter.add("b");

    expect(counter.count("a")).toBe(2);
    expect(counter.count("b")).toBe(1);
    expect(counter.count("c")).toBe(0);
    expect(counter.total).toBe(3);
    expect(counter.keys).toBe(2);
  });

  test("forgets keys that reach zero", () => {
    const counter = new KeyCounter();
    counter.add("a");
    counter.remove("a");

    expect(counter.count("a")).toBe(0);
    expect(counter.total).toBe(0);
    expect(counter.keys).toBe(0);
  });

  test("never removes more than was counted", () => {
    const counter = new KeyCounter();
    counter.remove("missing");

    expect(counter.total).toBe(0);
  });
});

describe("Budget", () => {
  test("hands out slots up to its capacity", () => {
    const budget = new Budget(2);

    expect(budget.reserve()).toBe(true);
    expect(budget.reserve()).toBe(true);
    expect(budget.reserve()).toBe(false);
    expect(budget.usedCount).toBe(2);

    budget.release();
    expect(budget.reserve()).toBe(true);
    expect(budget.limit).toBe(2);
  });

  test("ignores releases when nothing is reserved", () => {
    const budget = new Budget(1);
    budget.release();

    expect(budget.usedCount).toBe(0);
  });
});
