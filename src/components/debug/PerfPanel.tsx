import type { JSX } from "solid-js";
import type { CollectorSnapshot } from "./perfCollector";
import { computeHealth, frameBudget } from "./perfMetrics";
import { PerfActions } from "./PerfActions";
import {
  C_OK, C_WARN, C_BAD, C_DIM, C_MUTED,
  fmt, fmtUptime, barColor, fpsColor,
  healthReasons,
  SectionLabel, Stat, Row, SparklineRow, MemorySection,
} from "./PerfPanelComponents";

import "./PerfPanel.css";

// ---- Main component ----

export interface PerfPanelProps {
  snapshot: CollectorSnapshot;
  snapshots: readonly CollectorSnapshot[];
  /** Optional connection state prop (for Todo 5 integration) */
  isConnected?: boolean;
}

export function PerfPanel(props: PerfPanelProps): JSX.Element {
  const { snapshot, snapshots } = props;

  // Derived values
  const budget = frameBudget(snapshot.refreshRate);
  const heapPct = snapshot.memory?.jsHeapPercent ?? null;
  const health = computeHealth(
    snapshot.fps,
    snapshot.droppedFrames,
    snapshot.cpuMs,
    heapPct,
  );
  const healthDotColor = health === "critical" ? C_BAD : health === "warning" ? C_WARN : C_OK;
  const reasons = healthReasons(
    snapshot.fps,
    snapshot.droppedFrames,
    snapshot.cpuMs,
    heapPct,
  );
  const reasonText = reasons.length > 0
    ? reasons.map((r) => r.text).join(", ")
    : "All good";

  // Sparkline data — extract from history
  const fpsHistory = snapshots.map((s) => s.fps);
  const frameTimeHistory = snapshots.map((s) => s.frameTimeP99Ms);
  const heapHistory = snapshot.memory !== null
    ? snapshots.map((s) => s.memory?.heapUsedMB ?? 0)
    : [];
  const domHistory = snapshots.map((s) => s.domNodes);

  // Memory availability
  const memSupported = snapshot.memory !== null;
  const mem = snapshot.memory;

  // LCP
  const lcpMs = snapshot.lcpMs;

  return (
    <div class="perf-panel">
      {/* Health summary */}
      <div class="perf-health-row">
        <div
          class="perf-health-dot"
          style={{ background: healthDotColor }}
        />
        <span class="perf-health-reason">
          {health.toUpperCase()}: {reasonText}
        </span>
      </div>

      {/* ---- RENDER ---- */}
      <SectionLabel label="Render" />
      <Row
        label="FPS"
        value={`${fmt(snapshot.fps, 0)} fps`}
        sub={`5s low ${fmt(snapshot.minFps, 0)}`}
        color={fpsColor(snapshot.fps)}
        bar={Math.min(100, (snapshot.fps / snapshot.refreshRate) * 100)}
        barColor={fpsColor(snapshot.fps)}
      />
      <SparklineRow
        label="FPS"
        data={fpsHistory}
        color={fpsColor(snapshot.fps)}
        sparklineLabel="FPS trend"
      />
      <Row
        label="Worst frame"
        value={`${fmt(snapshot.frameTimeWorstMs)} ms`}
        sub={`p50 ${fmt(snapshot.frameTimeP50Ms)} / p95 ${fmt(snapshot.frameTimeP95Ms)} / p99 ${fmt(snapshot.frameTimeP99Ms)}`}
        color={snapshot.frameTimeWorstMs > budget + 1 ? C_BAD : C_OK}
        bar={Math.min(100, (snapshot.frameTimeWorstMs / (budget * 2)) * 100)}
        barColor={snapshot.frameTimeWorstMs > budget + 1 ? C_BAD : C_OK}
      />
      <SparklineRow
        label="Frame time p99"
        data={frameTimeHistory}
        color={C_WARN}
        sparklineLabel="Frame time p99 trend"
      />
      <Stat
        label="1% low FPS"
        value={`${fmt(snapshot.low1PercentFps, 0)} fps`}
        color={fpsColor(snapshot.low1PercentFps)}
      />
      <Stat
        label="Dropped frames"
        value={`${snapshot.droppedFrames} / s`}
        color={snapshot.droppedFrames > 5 ? C_BAD : snapshot.droppedFrames > 1 ? C_WARN : C_DIM}
      />

      {/* ---- MAIN THREAD ---- */}
      <SectionLabel label="Main thread" />
      <Row
        label="Long tasks"
        value={`${fmt(snapshot.cpuMs, 0)} ms/s`}
        sub={snapshot.longTaskCount > 0 ? `${snapshot.longTaskCount}x` : undefined}
        color={barColor(Math.min(100, (snapshot.cpuMs / 1000) * 100))}
        bar={Math.min(100, (snapshot.cpuMs / 1000) * 100)}
        barColor={barColor(Math.min(100, (snapshot.cpuMs / 1000) * 100))}
      />
      {lcpMs !== null && (
        <Stat
          label="LCP"
          value={`${fmt(lcpMs, 0)} ms`}
          color={lcpMs > 4000 ? C_BAD : lcpMs > 2500 ? C_WARN : C_OK}
        />
      )}

      {/* ---- MEMORY ---- */}
      <SectionLabel label="Memory" />
      {mem !== null
        ? <MemorySection memory={mem} heapHistory={heapHistory} />
        : <Stat label="JS Heap" value="N/A" color={C_DIM} />
      }

      {/* ---- PAGE ---- */}
      <SectionLabel label="Page" />
      <SparklineRow
        label="DOM nodes"
        data={domHistory}
        color={C_MUTED}
        sparklineLabel="DOM node trend"
      />
      <Stat
        label="DOM nodes"
        value={String(snapshot.domNodes)}
        color={snapshot.domNodes > 3000 ? C_BAD : snapshot.domNodes > 1500 ? C_WARN : C_MUTED}
      />
      <Stat
        label="WS open"
        value={props.isConnected === true ? "Connected" : "Disconnected"}
        color={props.isConnected === true ? C_OK : C_DIM}
      />
      <Stat label="Uptime" value={fmtUptime(snapshot.uptimeSec)} color={C_DIM} />

      {/* Support info */}
      <div style={{ color: "#52525b", "font-size": "9px", "margin-top": "4px" }}>
        {snapshot.refreshRate} Hz &middot; {window.innerWidth}x{window.innerHeight}px &middot; DPR {fmt(window.devicePixelRatio, 1)}
        {!memSupported && <span> &middot; Mem N/A</span>}
      </div>

      {/* Copy / Download actions */}
      <PerfActions snapshot={snapshot} snapshots={snapshots} />
    </div>
  );
}
