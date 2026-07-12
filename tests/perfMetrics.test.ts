import { describe, expect, test } from "bun:test";
import {
  classifyFrame,
  computeHealth,
  computeMemoryTrend,
  estimateRefreshRate,
  frameBudget,
  low1PercentFps,
  percentile,
} from "../src/components/debug/perfMetrics";

// ---------------------------------------------------------------------------
// Percentile calculation — pure, no mutation, edge-case hardened
// ---------------------------------------------------------------------------
describe("perfMetrics — percentile", () => {
  test("Given 1..100 sorted ascending When p=50 Then returns 50.5 (median)", () => {
    // Given: 100 consecutive integers, already sorted
    const input = Array.from({ length: 100 }, (_, i) => i + 1);
    // When: computing the 50th percentile
    const result = percentile(input, 50);
    // Then: R-7 interpolation gives 50.5
    expect(result).toBe(50.5);
  });

  test("Given 1..100 sorted ascending When p=95 Then returns 95.05", () => {
    const input = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(input, 95)).toBe(95.05);
  });

  test("Given 1..100 sorted ascending When p=99 Then returns 99.01", () => {
    const input = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(input, 99)).toBe(99.01);
  });

  test("Given an empty array When p=50 Then returns 0 without throwing", () => {
    // Given: no data
    // When / Then: gracefully handles empty input
    expect(percentile([], 50)).toBe(0);
  });

  test("Given a singleton array [42] When p=99 Then returns 42", () => {
    expect(percentile([42], 99)).toBe(42);
  });

  test("Given p=100 When array is [1,2,3] Then returns max 3", () => {
    expect(percentile([1, 2, 3], 100)).toBe(3);
  });

  test("Given p=0 When array is [1,2,3] Then returns min 1", () => {
    expect(percentile([1, 2, 3], 0)).toBe(1);
  });

  test("Given source array When percentile is computed Then original array is not mutated", () => {
    // Given: a concrete input
    const input = [10, 20, 30, 40, 50];
    // When: computing the 50th percentile
    percentile(input, 50);
    // Then: the input was not sorted or modified in place
    expect(input).toEqual([10, 20, 30, 40, 50]);
  });

  test("Given array containing NaN When computed Then does not throw", () => {
    // Boundary: non-finite values must not crash the function
    expect(() => percentile([NaN, 10, 20], 50)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Refresh rate estimation — snaps to known rates, 60 Hz fallback
// ---------------------------------------------------------------------------
describe("perfMetrics — estimateRefreshRate", () => {
  test("Given 60 evenly-spaced rAF timestamps at ~16.67ms intervals When estimated Then returns 60", () => {
    const timestamps = Array.from({ length: 60 }, (_, i) => +(i * 16.67).toFixed(2));
    expect(estimateRefreshRate(timestamps)).toBe(60);
  });

  test("Given empty array When estimated Then returns default 60 Hz fallback", () => {
    expect(estimateRefreshRate([])).toBe(60);
  });

  test("Given singleton array When estimated Then returns default 60 Hz fallback", () => {
    expect(estimateRefreshRate([100])).toBe(60);
  });

  test("Given intervals at ~6.94ms (144 Hz) When estimated Then snaps to 144", () => {
    const timestamps = Array.from({ length: 60 }, (_, i) => +(i * 6.94).toFixed(2));
    expect(estimateRefreshRate(timestamps)).toBe(144);
  });

  test("Given intervals with noise When estimated Then snaps to correct rate (120 Hz)", () => {
    const ideal = 1000 / 120; // ~8.33ms
    const noisy = Array.from({ length: 50 }, (_, i) => i * ideal + (i % 3) * 0.1);
    expect(estimateRefreshRate(noisy)).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// Frame budget — simple math but worth nailing the contract
// ---------------------------------------------------------------------------
describe("perfMetrics — frameBudget", () => {
  test("Given 60 Hz When budget computed Then returns ~16.67", () => {
    expect(frameBudget(60)).toBeCloseTo(16.67, 1);
  });

  test("Given 144 Hz When budget computed Then returns ~6.94", () => {
    expect(frameBudget(144)).toBeCloseTo(6.94, 1);
  });

  test("Given 0 Hz (guard) When budget computed Then returns Infinity", () => {
    expect(frameBudget(0)).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// Frame classification — refresh-relative, non-finite guards
// ---------------------------------------------------------------------------
describe("perfMetrics — classifyFrame", () => {
  test("Given frame time 4ms at 144 Hz budget When classified Then returns 'ok'", () => {
    // Given: a fast frame well within the ~6.94 ms budget of a 144 Hz display
    const budget = frameBudget(144);
    // When / Then
    expect(classifyFrame(4, budget)).toBe("ok");
  });

  test("Given frame time 12ms at 144 Hz budget When classified Then returns 'dropped'", () => {
    // Given: a frame that exceeds the ~6.94 ms budget
    const budget = frameBudget(144);
    expect(classifyFrame(12, budget)).toBe("dropped");
  });

  test("Given frame time 16.67ms at 60 Hz budget When classified Then returns 'ok'", () => {
    expect(classifyFrame(16.67, frameBudget(60))).toBe("ok");
  });

  test("Given frame time 17ms at 60 Hz When classified Then returns 'dropped'", () => {
    expect(classifyFrame(17, frameBudget(60))).toBe("dropped");
  });

  test("Given non-finite frame time When classified Then returns 'dropped'", () => {
    expect(classifyFrame(NaN, 16.67)).toBe("dropped");
    expect(classifyFrame(Infinity, 16.67)).toBe("dropped");
  });
});

// ---------------------------------------------------------------------------
// 1% low FPS — gaming-benchmark-style metric
// ---------------------------------------------------------------------------
describe("perfMetrics — low1PercentFps", () => {
  test("Given 100 sorted frame times (one 15ms outlier, rest 10ms) When computed Then 1% low is ~66.7 FPS", () => {
    // Given: worst 1% = 1 frame at 15ms
    const times = Array.from({ length: 99 }, () => 10).concat([15]);
    const sorted = [...times].sort((a, b) => a - b);
    // When / Then: mean of worst 1% (15ms) → FPS = 1000/15 ≈ 66.67
    expect(low1PercentFps(sorted)).toBeCloseTo(1000 / 15, 1);
  });

  test("Given empty array When computed Then returns 0", () => {
    expect(low1PercentFps([])).toBe(0);
  });

  test("Given singleton [8.33] When computed Then returns ~120 FPS", () => {
    expect(low1PercentFps([8.33])).toBeCloseTo(1000 / 8.33, 1);
  });

  test("Given all frame times at 16.67ms When computed Then returns ~60 FPS", () => {
    const times = Array.from({ length: 60 }, () => 16.67);
    expect(low1PercentFps(times)).toBeCloseTo(1000 / 16.67, 1);
  });

  test("Given array containing non-finite values When computed Then does not throw", () => {
    expect(() => low1PercentFps([NaN, 10, Infinity, 20])).not.toThrow();
  });

  test("Given source array When computed Then original array is not mutated", () => {
    const input = [10, 20, 30, 40, 50];
    low1PercentFps(input);
    expect(input).toEqual([10, 20, 30, 40, 50]);
  });
});

// ---------------------------------------------------------------------------
// Memory trend — optional-memory behavior, empty/singleton/trend
// ---------------------------------------------------------------------------
describe("perfMetrics — computeMemoryTrend", () => {
  test("Given 5 ascending heap samples When computed Then slope is 'increasing'", () => {
    const trend = computeMemoryTrend([10, 12, 15, 18, 22]);
    expect(trend.slope).toBe("increasing");
    expect(trend.min).toBe(10);
    expect(trend.max).toBe(22);
    expect(trend.avg).toBeCloseTo(15.4, 1);
  });

  test("Given descending heap samples When computed Then slope is 'decreasing'", () => {
    const trend = computeMemoryTrend([30, 25, 20, 15]);
    expect(trend.slope).toBe("decreasing");
  });

  test("Given stable heap samples When computed Then slope is 'stable'", () => {
    const trend = computeMemoryTrend([20, 20, 20, 20]);
    expect(trend.slope).toBe("stable");
  });

  test("Given empty samples When computed Then returns zeros with 'stable' slope", () => {
    const trend = computeMemoryTrend([]);
    expect(trend.min).toBe(0);
    expect(trend.max).toBe(0);
    expect(trend.avg).toBe(0);
    expect(trend.slope).toBe("stable");
  });

  test("Given singleton sample When computed Then min=max=avg, slope is 'stable'", () => {
    const trend = computeMemoryTrend([42]);
    expect(trend.min).toBe(42);
    expect(trend.max).toBe(42);
    expect(trend.avg).toBe(42);
    expect(trend.slope).toBe("stable");
  });

  test("Given heap unavailable (empty array) When computed Then returns safe zero stable trend", () => {
    // Simulates performance.memory being absent — must not crash or return
    // misleading non-zero values.
    const trend = computeMemoryTrend([]);
    expect(trend.slope).toBe("stable");
    expect(trend.min).toBe(0);
    expect(trend.max).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Health state — good / warning / critical
// ---------------------------------------------------------------------------
describe("perfMetrics — computeHealth", () => {
  test("Given 60 fps, 0 dropped, 0ms long tasks, no memory pressure When computed Then returns 'good'", () => {
    expect(computeHealth(60, 0, 0, null)).toBe("good");
  });

  test("Given 45 fps, 2 dropped, 50ms long tasks, 60% heap When computed Then returns 'warning'", () => {
    expect(computeHealth(45, 2, 50, 60)).toBe("warning");
  });

  test("Given 20 fps, 10 dropped, 500ms long tasks, 95% heap When computed Then returns 'critical'", () => {
    expect(computeHealth(20, 10, 500, 95)).toBe("critical");
  });

  test("Given borderline warning: 55 fps, 3 dropped, 150ms long tasks When computed Then returns 'warning'", () => {
    expect(computeHealth(55, 3, 150, null)).toBe("warning");
  });

  test("Given null memory pressure with otherwise good metrics When computed Then health is 'good'", () => {
    // Memory is optional — absence should not degrade health
    expect(computeHealth(60, 0, 0, null)).toBe("good");
  });

  test("Given extreme values (0 fps, many dropped) When computed Then returns 'critical'", () => {
    expect(computeHealth(0, 100, 2000, 99)).toBe("critical");
  });
});
