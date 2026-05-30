import { createSignal, onCleanup, onMount, Show } from "solid-js";

type PerfSnapshot = {
  // Memory
  heapUsedMB: number;
  heapTotalMB: number;
  heapLimitMB: number;
  jsHeapPercent: number;
  heapDeltaMB: number;
  // Rendering
  fps: number;
  frameTimeP99Ms: number;  // worst frame in last second (p99-ish)
  frameTimeWorstMs: number; // absolute worst frame in last second
  droppedFrames: number;   // frames > 20ms in last second
  minFps: number;
  // CPU
  cpuMs: number;
  longTaskCount: number;
  // DOM
  domNodes: number;
  // Network
  wsCount: number;
  // Page
  uptimeSec: number;
  lcpMs: number;
};

// Monkey-patch WebSocket to count open connections — installed lazily on first mount
let _wsCount = 0;

function ensureWSPatch() {
  if (typeof window === "undefined" || (window as any).__perfMonitorPatched) return;
  (window as any).__perfMonitorPatched = true;
  const OrigWS = window.WebSocket;
  (window as any).WebSocket = function (...args: ConstructorParameters<typeof WebSocket>) {
    const ws = new OrigWS(...args);
    _wsCount++;
    const done = () => { _wsCount = Math.max(0, _wsCount - 1); };
    ws.addEventListener("close", done);
    ws.addEventListener("error", done);
    return ws;
  } as unknown as typeof WebSocket;
  Object.assign((window as any).WebSocket, OrigWS);
}

function getMemory() {
  const mem = (performance as any).memory;
  if (!mem) return null;
  const used = mem.usedJSHeapSize / 1024 / 1024;
  const total = mem.totalJSHeapSize / 1024 / 1024;
  const limit = mem.jsHeapSizeLimit / 1024 / 1024;
  return { used, total, limit, pct: (used / limit) * 100 };
}

function fmt(n: number, d = 1) { return n.toFixed(d); }
function fmtUptime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function PerfMonitor() {
  const [visible, setVisible] = createSignal(true);
  const [snap, setSnap] = createSignal<PerfSnapshot | null>(null);

  let frameCount = 0;
  let lastFpsTime = performance.now();
  // frameTimes only for current second window, cleared each interval tick
  let frameTimesWindow: number[] = [];
  let lastFrameTime = performance.now();
  let rafId = 0;
  let intervalId = 0;
  let ltMs = 0;
  let ltCount = 0;
  let minFpsWindow: number[] = [];
  let prevHeapUsed = 0;
  let lcpMs = 0;
  let observers: PerformanceObserver[] = [];

  onMount(() => {
    ensureWSPatch();

    // Long task observer
    try {
      const ltObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          ltMs += entry.duration;
          ltCount++;
        }
      });
      ltObs.observe({ entryTypes: ["longtask"] });
      observers.push(ltObs);
    } catch { /* not supported */ }

    // LCP observer
    try {
      const lcpObs = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) lcpMs = entries[entries.length - 1].startTime;
      });
      lcpObs.observe({ entryTypes: ["largest-contentful-paint"] });
      observers.push(lcpObs);
    } catch { /* not supported */ }

    // FPS + frame time via rAF
    const countFrame = () => {
      const now = performance.now();
      frameTimesWindow.push(now - lastFrameTime);
      lastFrameTime = now;
      frameCount++;
      rafId = requestAnimationFrame(countFrame);
    };
    rafId = requestAnimationFrame(countFrame);

    // Snapshot every second
    intervalId = window.setInterval(() => {
      const now = performance.now();
      const elapsed = (now - lastFpsTime) / 1000;
      const fps = frameCount / elapsed;

      // Per-second frame time stats (reset each tick — true "last second" window)
      const window = frameTimesWindow.slice();
      frameTimesWindow = [];
      frameCount = 0;
      lastFpsTime = now;

      const sorted = window.slice().sort((a, b) => a - b);
      const p99idx = Math.max(0, Math.floor(sorted.length * 0.99) - 1);
      const p99 = sorted[p99idx] ?? 0;
      const worst = sorted[sorted.length - 1] ?? 0;
      const dropped = window.filter((t) => t > 20).length; // >20ms = missed 60fps target

      // Rolling 5s min FPS
      minFpsWindow.push(fps);
      if (minFpsWindow.length > 5) minFpsWindow.shift();
      const minFps = Math.min(...minFpsWindow);

      const mem = getMemory();
      const heapDelta = mem ? mem.used - prevHeapUsed : 0;
      if (mem) prevHeapUsed = mem.used;

      const cpu = ltMs;
      const lCount = ltCount;
      ltMs = 0;
      ltCount = 0;

      setSnap({
        heapUsedMB: mem?.used ?? 0,
        heapTotalMB: mem?.total ?? 0,
        heapLimitMB: mem?.limit ?? 0,
        jsHeapPercent: mem?.pct ?? 0,
        heapDeltaMB: heapDelta,
        fps,
        frameTimeP99Ms: p99,
        frameTimeWorstMs: worst,
        droppedFrames: dropped,
        minFps,
        cpuMs: cpu,
        longTaskCount: lCount,
        domNodes: document.querySelectorAll("*").length,
        wsCount: _wsCount,
        uptimeSec: performance.now() / 1000,
        lcpMs,
      });
    }, 1000);

    onCleanup(() => {
      cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
      observers.forEach((o) => o.disconnect());
    });
  });

  const c = {
    ok: "#22c55e",
    warn: "#f59e0b",
    bad: "#ef4444",
    dim: "#71717a",
    muted: "#a1a1aa",
  };

  const barColor = (pct: number) => pct > 80 ? c.bad : pct > 50 ? c.warn : c.ok;
  const fpsColor = (fps: number) => fps < 30 ? c.bad : fps < 50 ? c.warn : c.ok;
  const deltaColor = (d: number) => d > 5 ? c.bad : d > 1 ? c.warn : d < -1 ? "#60a5fa" : c.muted;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "12px",
        right: "12px",
        "z-index": "99999",
        "font-family": "monospace",
        "font-size": "11px",
        "line-height": "1.5",
        "user-select": "none",
      }}
    >
      <button
        onClick={() => setVisible((v) => !v)}
        style={{
          display: "block",
          "margin-left": "auto",
          background: "#18181b",
          border: "1px solid #3f3f46",
          color: "#a1a1aa",
          "border-radius": "4px",
          padding: "2px 6px",
          cursor: "pointer",
          "font-size": "10px",
          "margin-bottom": "4px",
        }}
      >
        {visible() ? "▼ perf" : "▲ perf"}
      </button>
      <Show when={visible() && snap() !== null}>
        <div
          style={{
            background: "rgba(9,9,11,0.94)",
            border: "1px solid #27272a",
            "border-radius": "6px",
            padding: "8px 10px",
            "min-width": "220px",
            "backdrop-filter": "blur(6px)",
          }}
        >
          {/* Section: Rendering */}
          <SectionLabel label="RENDER" />
          <Row
            label="FPS"
            value={`${fmt(snap()!.fps, 0)} fps`}
            sub={`min ${fmt(snap()!.minFps, 0)}`}
            color={fpsColor(snap()!.fps)}
            bar={Math.min(100, (snap()!.fps / 60) * 100)}
            barColor={fpsColor(snap()!.fps)}
          />
          <Row
            label="Worst frame"
            value={`${fmt(snap()!.frameTimeWorstMs)} ms`}
            sub={`p99 ${fmt(snap()!.frameTimeP99Ms)} ms`}
            color={snap()!.frameTimeWorstMs > 33 ? c.bad : snap()!.frameTimeWorstMs > 20 ? c.warn : c.ok}
            bar={Math.min(100, (snap()!.frameTimeWorstMs / 33.3) * 100)}
            barColor={snap()!.frameTimeWorstMs > 33 ? c.bad : snap()!.frameTimeWorstMs > 20 ? c.warn : c.ok}
          />
          <Stat
            label="Dropped frames"
            value={`${snap()!.droppedFrames} / s`}
            color={snap()!.droppedFrames > 5 ? c.bad : snap()!.droppedFrames > 1 ? c.warn : c.dim}
          />

          {/* Section: CPU */}
          <SectionLabel label="CPU" />
          <Row
            label="Long tasks"
            value={`${fmt(snap()!.cpuMs, 0)} ms/s`}
            sub={snap()!.longTaskCount > 0 ? `${snap()!.longTaskCount}x` : undefined}
            color={barColor(Math.min(100, (snap()!.cpuMs / 1000) * 100))}
            bar={Math.min(100, (snap()!.cpuMs / 1000) * 100)}
            barColor={barColor(Math.min(100, (snap()!.cpuMs / 1000) * 100))}
          />

          {/* Section: Memory */}
          <SectionLabel label="MEMORY" />
          <Row
            label="JS Heap"
            value={`${fmt(snap()!.heapUsedMB)} / ${fmt(snap()!.heapLimitMB)} MB`}
            sub={`alloc ${fmt(snap()!.heapTotalMB)} MB`}
            color={barColor(snap()!.jsHeapPercent)}
            bar={snap()!.jsHeapPercent}
            barColor={barColor(snap()!.jsHeapPercent)}
          />
          <Stat
            label="Heap delta"
            value={`${snap()!.heapDeltaMB >= 0 ? "+" : ""}${fmt(snap()!.heapDeltaMB)} MB`}
            color={deltaColor(snap()!.heapDeltaMB)}
          />

          {/* Section: DOM / Network */}
          <SectionLabel label="PAGE" />
          <Stat
            label="DOM nodes"
            value={String(snap()!.domNodes)}
            color={snap()!.domNodes > 3000 ? c.bad : snap()!.domNodes > 1500 ? c.warn : c.muted}
          />
          <Stat
            label="WS open"
            value={String(snap()!.wsCount)}
            color={snap()!.wsCount === 0 ? c.dim : c.ok}
          />
          <Show when={snap()!.lcpMs > 0}>
            <Stat
              label="LCP"
              value={`${fmt(snap()!.lcpMs, 0)} ms`}
              color={snap()!.lcpMs > 4000 ? c.bad : snap()!.lcpMs > 2500 ? c.warn : c.ok}
            />
          </Show>
          <Stat label="Uptime" value={fmtUptime(snap()!.uptimeSec)} color={c.dim} />
        </div>
      </Show>
    </div>
  );
}

function SectionLabel(props: { label: string }) {
  return (
    <div style={{
      color: "#52525b",
      "font-size": "9px",
      "letter-spacing": "0.08em",
      "margin-top": "8px",
      "margin-bottom": "3px",
      "border-bottom": "1px solid #1f1f23",
      "padding-bottom": "2px",
    }}>
      {props.label}
    </div>
  );
}

function Stat(props: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", "justify-content": "space-between", "margin-bottom": "2px" }}>
      <span style={{ color: "#71717a" }}>{props.label}</span>
      <span style={{ color: props.color }}>{props.value}</span>
    </div>
  );
}

function Row(props: { label: string; value: string; sub?: string; color: string; bar: number; barColor: string }) {
  return (
    <div style={{ "margin-bottom": "5px" }}>
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "baseline" }}>
        <span style={{ color: "#71717a" }}>{props.label}</span>
        <span style={{ "text-align": "right" }}>
          <span style={{ color: props.color }}>{props.value}</span>
          {props.sub && (
            <span style={{ color: "#52525b", "font-size": "9px", "margin-left": "4px" }}>
              {props.sub}
            </span>
          )}
        </span>
      </div>
      <div
        style={{
          height: "2px",
          background: "#27272a",
          "border-radius": "1px",
          "margin-top": "2px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${props.bar}%`,
            background: props.barColor,
            transition: "width 0.4s ease",
            "border-radius": "1px",
          }}
        />
      </div>
    </div>
  );
}
