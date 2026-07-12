// ---- Types ----------------------------------------------------------------

export type Slope = "increasing" | "decreasing" | "stable";

export type ComputeMemoryTrendResult = Readonly<{
  slope: Slope;
  min: number;
  max: number;
  avg: number;
}>;

// ---- Constants ------------------------------------------------------------

const KNOWN_REFRESH_RATES: readonly number[] = [30, 60, 90, 120, 144, 165, 240];
const DEFAULT_REFRESH_RATE = 60;
const DROPPED_EPSILON = 0.01;
const SLOPE_THRESHOLD = 0.5;
const LOW_FPS_CRITICAL = 30;
const LOW_FPS_WARNING = 50;
const LONG_TASK_WARNING_MS = 100;
const DROPPED_WARNING_THRESHOLD = 5;
const HEAP_WARNING_PCT = 80;

// ---- Percentile (R-7 interpolation) ---------------------------------------

export function percentile(data: readonly number[], p: number): number {
  const cleaned = data.filter((v) => Number.isFinite(v));
  if (cleaned.length === 0) return 0;
  const sorted = [...cleaned].sort((a, b) => a - b);
  const n = sorted.length;
  const h = (n - 1) * (p / 100);
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

// ---- Refresh rate estimation ----------------------------------------------

export function estimateRefreshRate(timestamps: readonly number[]): number {
  if (timestamps.length < 2) return DEFAULT_REFRESH_RATE;
  const n = timestamps.length - 1;
  let totalInterval = 0;
  for (let i = 1; i <= n; i++) {
    totalInterval += timestamps[i] - timestamps[i - 1];
  }
  const meanInterval = totalInterval / n;
  if (meanInterval <= 0) return DEFAULT_REFRESH_RATE;
  const estimated = 1000 / meanInterval;
  let best = DEFAULT_REFRESH_RATE;
  let bestDiff = Math.abs(estimated - best);
  for (const rate of KNOWN_REFRESH_RATES) {
    const diff = Math.abs(estimated - rate);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = rate;
    }
  }
  return best;
}

// ---- Frame budget ---------------------------------------------------------

export function frameBudget(refreshRate: number): number {
  if (refreshRate <= 0) return Infinity;
  return 1000 / refreshRate;
}

// ---- Frame classification -------------------------------------------------

export function classifyFrame(
  frameTime: number,
  budget: number,
): "ok" | "dropped" {
  if (!Number.isFinite(frameTime)) return "dropped";
  return frameTime > budget + DROPPED_EPSILON ? "dropped" : "ok";
}

// ---- 1% low FPS -----------------------------------------------------------

export function low1PercentFps(frameTimes: readonly number[]): number {
  const cleaned = frameTimes.filter((v) => Number.isFinite(v));
  if (cleaned.length === 0) return 0;
  const sorted = [...cleaned].sort((a, b) => a - b);
  const count = Math.max(1, Math.ceil(sorted.length * 0.01));
  const worst = sorted.slice(-count);
  const mean = worst.reduce((s, v) => s + v, 0) / worst.length;
  return 1000 / mean;
}

// ---- Memory trend ---------------------------------------------------------

export function computeMemoryTrend(
  samples: readonly number[],
): ComputeMemoryTrendResult {
  if (samples.length === 0) {
    return { slope: "stable", min: 0, max: 0, avg: 0 };
  }
  if (samples.length === 1) {
    const v = samples[0];
    return { slope: "stable", min: v, max: v, avg: v };
  }
  const n = samples.length;
  const sumX = (n * (n - 1)) / 2; // 0 + 1 + ... + (n-1)
  const sumY = samples.reduce((s, v) => s + v, 0);
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumXY += i * samples[i];
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const max = Math.max(...samples);
  const min = Math.min(...samples);
  const avg = sumY / n;
  return {
    slope:
      slope > SLOPE_THRESHOLD
        ? "increasing"
        : slope < -SLOPE_THRESHOLD
          ? "decreasing"
          : "stable",
    min,
    max,
    avg,
  };
}

// ---- Health ---------------------------------------------------------------

export function computeHealth(
  fps: number,
  droppedFrames: number,
  longTaskMs: number,
  heapPercent: number | null,
): "good" | "warning" | "critical" {
  if (fps < LOW_FPS_CRITICAL) return "critical";
  if (fps < LOW_FPS_WARNING) return "warning";
  if (droppedFrames > DROPPED_WARNING_THRESHOLD) return "warning";
  if (longTaskMs > LONG_TASK_WARNING_MS) return "warning";
  if (heapPercent !== null && heapPercent > HEAP_WARNING_PCT) return "warning";
  return "good";
}
