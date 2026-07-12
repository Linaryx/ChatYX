// Browser performance data collector.
// Owns rAF sampling, PerformanceObservers, optional performance.memory,
// DOM counts, and environment state. Maintains a bounded 60-snapshot
// history and bounded 250-frame sample window for diagnostics.
// Call start() in onMount / stop() in onCleanup (idempotent). The
// subscription API returns an unsubscribe function for SolidJS clean-up.
// Frame sample maximum: 250 entries per window (supports >200 Hz
// displays with headroom). When the window exceeds this, new entries
// are discarded until the next snapshot resets the window.

import {
  classifyFrame,
  estimateRefreshRate,
  frameBudget,
  low1PercentFps,
  percentile,
} from "./perfMetrics";

// Global augmentation — non-standard performance.memory (Chrome only)
declare global {
  interface Performance {
    readonly memory?: {
      readonly usedJSHeapSize: number;
      readonly totalJSHeapSize: number;
      readonly jsHeapSizeLimit: number;
    };
  }
}

// Exported types

export interface EnvInfo {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly devicePixelRatio: number;
  readonly online: boolean;
  readonly visible: boolean;
}

export interface MemorySnapshot {
  readonly heapUsedMB: number;
  readonly heapTotalMB: number;
  readonly heapLimitMB: number;
  readonly jsHeapPercent: number;
  readonly heapDeltaMB: number;
}

export interface CollectorSnapshot {
  readonly timestamp: number;
  readonly fps: number;
  readonly refreshRate: number;
  readonly frameTimeP50Ms: number;
  readonly frameTimeP95Ms: number;
  readonly frameTimeP99Ms: number;
  readonly frameTimeWorstMs: number;
  readonly low1PercentFps: number;
  readonly droppedFrames: number;
  readonly minFps: number;
  readonly cpuMs: number;
  readonly longTaskCount: number;
  readonly memory: MemorySnapshot | null;
  readonly domNodes: number;
  readonly lcpMs: number | null;
  readonly env: EnvInfo;
  readonly uptimeSec: number;
}

export type SnapshotListener = (snapshot: CollectorSnapshot) => void;

/** Observer/API support flags — populated after start() */
export interface SupportInfo {
  readonly performanceObserver: boolean;
  readonly longTaskObserver: boolean;
  readonly lcpObserver: boolean;
  readonly memoryApi: boolean;
}

// Constants

const MAX_SNAPSHOTS = 60, MAX_FRAME_SAMPLES = 250, SNAPSHOT_INTERVAL_MS = 1000;
const REFRESH_ESTIMATE_INTERVAL = 5, MIN_FPS_WINDOW = 5;

// Module-level state (private)

let _rafId = 0, _intervalId = 0, _observers: PerformanceObserver[] = [];
let _frameSamples: number[] = [], _rafTimestamps: number[] = [], _lastFrameTime = 0;
let _frameCount = 0, _fpsHistory: number[] = [], _prevHeapUsed = 0;
let _ltMs = 0, _ltCount = 0, _lcpMs = 0;
let _snapshots: CollectorSnapshot[] = [], _listeners = new Set<SnapshotListener>();
let _started = false, _startTime = 0, _lastSnapshotTime = 0, _refreshRate = 60, _ticksSinceRefresh = 0;
let _online = typeof navigator !== "undefined" ? navigator.onLine : true;
let _visible = typeof document !== "undefined" ? !document.hidden : true;
// Observer/API support — populated in start()
let _hasLongTaskObserver = false, _hasLcpObserver = false;

// Helpers

function tryCreateObserver(
  entryType: string,
  callback: (entry: PerformanceEntry) => void,
): PerformanceObserver | null {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        callback(entry);
      }
    });
    observer.observe({ entryTypes: [entryType] });
    return observer;
  } catch {
    return null;
  }
}

function collectEnvironment(): EnvInfo {
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    online: _online,
    visible: _visible,
  };
}

function readMemory(): MemorySnapshot | null {
  const mem = performance.memory;
  if (!mem) return null;
  const used = mem.usedJSHeapSize / 1024 / 1024;
  const total = mem.totalJSHeapSize / 1024 / 1024;
  const limit = mem.jsHeapSizeLimit / 1024 / 1024;
  return {
    heapUsedMB: used,
    heapTotalMB: total,
    heapLimitMB: limit,
    jsHeapPercent: (used / limit) * 100,
    heapDeltaMB: used - _prevHeapUsed,
  };
}

// Public API

export function subscribe(listener: SnapshotListener): () => void {
  _listeners.add(listener);
  return (): void => {
    _listeners.delete(listener);
  };
}

export function start(): void {
  if (_started) return;
  if (typeof window === "undefined") return;
  _started = true;
  _startTime = performance.now();
  _lastSnapshotTime = _startTime;

  const ltObserver = tryCreateObserver("longtask", (entry) => {
    _ltMs += entry.duration;
    _ltCount++;
  });
  _hasLongTaskObserver = ltObserver !== null;
  if (ltObserver !== null) _observers.push(ltObserver);

  const lcpObserver = tryCreateObserver("largest-contentful-paint", (entry) => {
    _lcpMs = entry.startTime;
  });
  _hasLcpObserver = lcpObserver !== null;
  if (lcpObserver !== null) _observers.push(lcpObserver);

  // rAF loop
  _lastFrameTime = performance.now();
  const frameCallback = (): void => {
    const now = performance.now();
    const duration = now - _lastFrameTime;
    if (_frameSamples.length < MAX_FRAME_SAMPLES) {
      _frameSamples.push(duration);
    }
    if (_rafTimestamps.length < 300) {
      _rafTimestamps.push(now);
    }
    _lastFrameTime = now;
    _frameCount++;
    _rafId = requestAnimationFrame(frameCallback);
  };
  _rafId = requestAnimationFrame(frameCallback);

  _intervalId = window.setInterval(takeSnapshot, SNAPSHOT_INTERVAL_MS);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("resize", handleResize);
}

export function stop(): void {
  if (!_started) return;
  _started = false;

  cancelAnimationFrame(_rafId);
  _rafId = 0;

  window.clearInterval(_intervalId);
  _intervalId = 0;

  for (const observer of _observers) {
    observer.disconnect();
  }
  _observers = [];

  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  document.removeEventListener("visibilitychange", handleVisibility);
  window.removeEventListener("resize", handleResize);

  _snapshots = [];
  _frameSamples = [];
  _rafTimestamps = [];
  _frameCount = 0;
  _lastFrameTime = 0;
  _ltMs = 0;
  _ltCount = 0;
  _fpsHistory = [];
  _hasLongTaskObserver = false;
  _hasLcpObserver = false;
}

export function getSnapshots(): readonly CollectorSnapshot[] {
  return _snapshots;
}

export function getCurrentSnapshot(): CollectorSnapshot | null {
  return _snapshots.length > 0 ? _snapshots[_snapshots.length - 1] : null;
}

export function getSupport(): SupportInfo {
  return {
    performanceObserver: typeof PerformanceObserver !== "undefined",
    longTaskObserver: _hasLongTaskObserver,
    lcpObserver: _hasLcpObserver,
    memoryApi: typeof performance.memory !== "undefined",
  };
}

// Internal

function notifyListeners(snapshot: CollectorSnapshot): void {
  for (const listener of _listeners) {
    listener(snapshot);
  }
}

// Named function references for removeEventListener
function handleOnline(): void { _online = true; }
function handleOffline(): void { _online = false; }
function handleVisibility(): void { _visible = !document.hidden; }
function handleResize(): void { /* env read lazily at snapshot time */ }

function takeSnapshot(): void {
  const now = performance.now();
  const elapsed = (now - _startTime) / 1000;
  const snapshotElapsed = (now - _lastSnapshotTime) / 1000;
  _lastSnapshotTime = now;
  const fps = snapshotElapsed > 0 ? _frameCount / snapshotElapsed : 0;
  // Drain current frame window — frameCount and samples are per-snapshot
  const window = _frameSamples;
  _frameSamples = [];
  _frameCount = 0;
  const sorted = window.slice().sort((a, b) => a - b);
  const len = sorted.length;
  const p50 = len > 0 ? percentile(sorted, 50) : 0;
  const p95 = len > 0 ? percentile(sorted, 95) : 0;
  const p99 = len > 0 ? percentile(sorted, 99) : 0;
  const worst = len > 0 ? sorted[len - 1] : 0;
  const budget = frameBudget(_refreshRate);
  const dropped = window.filter((t) => classifyFrame(t, budget) === "dropped").length;
  // Rolling min FPS (5s window)
  _fpsHistory.push(fps);
  if (_fpsHistory.length > MIN_FPS_WINDOW) _fpsHistory.shift();
  const minFps = _fpsHistory.length > 0 ? Math.min(..._fpsHistory) : 0;
  // Refresh rate estimation
  _ticksSinceRefresh++;
  if (_ticksSinceRefresh >= REFRESH_ESTIMATE_INTERVAL && _rafTimestamps.length >= 2) {
    _refreshRate = estimateRefreshRate(_rafTimestamps);
    _rafTimestamps = _rafTimestamps.slice(-60);
    _ticksSinceRefresh = 0;
  }
  const low1Fps = low1PercentFps(sorted);
  // Memory
  const mem = readMemory();
  if (mem !== null) _prevHeapUsed = mem.heapUsedMB;
  // CPU — drain long-task accumulators
  const cpuMs = _ltMs;
  const ltCount = _ltCount;
  _ltMs = 0;
  _ltCount = 0;
  // LCP
  const lcp = _lcpMs > 0 ? _lcpMs : null;
  const snapshot: CollectorSnapshot = {
    timestamp: now, fps, refreshRate: _refreshRate,
    frameTimeP50Ms: p50, frameTimeP95Ms: p95, frameTimeP99Ms: p99,
    frameTimeWorstMs: worst, low1PercentFps: low1Fps,
    droppedFrames: dropped, minFps, cpuMs, longTaskCount: ltCount,
    memory: mem, domNodes: document.querySelectorAll("*").length,
    lcpMs: lcp, env: collectEnvironment(), uptimeSec: elapsed,
  };
  _snapshots.push(snapshot);
  if (_snapshots.length > MAX_SNAPSHOTS) {
    _snapshots = _snapshots.slice(_snapshots.length - MAX_SNAPSHOTS);
  }
  notifyListeners(snapshot);
}
