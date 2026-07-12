// Shared sub-components and helpers for the performance panel.
// Extracted from PerfPanel.tsx to keep every source file under 250 pure LOC.

import type { JSX } from "solid-js";
import type { MemorySnapshot } from "./perfCollector";
import { Sparkline } from "./Sparkline";

// ---- Color palette (matching existing OBS-overlay look) ----

export const C_OK = "#22c55e";
export const C_WARN = "#f59e0b";
export const C_BAD = "#ef4444";
export const C_DIM = "#71717a";
export const C_MUTED = "#a1a1aa";

// ---- Helpers ----

export function fmt(n: number, d = 1): string {
  return n.toFixed(d);
}

export function fmtUptime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function barColor(pct: number): string {
  return pct > 80 ? C_BAD : pct > 50 ? C_WARN : C_OK;
}

export function fpsColor(fps: number): string {
  return fps < 30 ? C_BAD : fps < 50 ? C_WARN : C_OK;
}

export function deltaColor(d: number): string {
  return d > 5 ? C_BAD : d > 1 ? C_WARN : d < -1 ? "#60a5fa" : C_MUTED;
}

// ---- Health ----

export const LOW_FPS_CRITICAL = 30;
export const LOW_FPS_WARNING = 50;
export const LONG_TASK_WARNING_MS = 100;
export const DROPPED_WARNING_THRESHOLD = 5;
export const HEAP_WARNING_PCT = 80;

export interface HealthReason {
  text: string;
  color: string;
}

export function healthReasons(
  fps: number,
  droppedFrames: number,
  cpuMs: number,
  heapPct: number | null,
): HealthReason[] {
  const reasons: HealthReason[] = [];
  if (fps < LOW_FPS_CRITICAL) {
    reasons.push({ text: `FPS ${fmt(fps, 0)}`, color: C_BAD });
  } else if (fps < LOW_FPS_WARNING) {
    reasons.push({ text: `FPS ${fmt(fps, 0)}`, color: C_WARN });
  }
  if (droppedFrames > DROPPED_WARNING_THRESHOLD) {
    reasons.push({ text: `Dropped ${fmt(droppedFrames, 0)}/s`, color: C_WARN });
  }
  if (cpuMs > LONG_TASK_WARNING_MS) {
    reasons.push({ text: `Long tasks ${fmt(cpuMs, 0)}ms`, color: C_WARN });
  }
  if (heapPct !== null && heapPct > HEAP_WARNING_PCT) {
    reasons.push({ text: `Heap ${fmt(heapPct, 0)}%`, color: C_WARN });
  }
  return reasons;
}

// ---- Section label ----

export interface SectionLabelProps {
  label: string;
}

export function SectionLabel(props: SectionLabelProps): JSX.Element {
  return <div class="perf-section-label">{props.label}</div>;
}

// ---- Single stat row ----

export interface StatProps {
  label: string;
  value: string;
  color: string;
}

export function Stat(props: StatProps): JSX.Element {
  return (
    <div class="perf-stat-row">
      <span class="perf-stat-label">{props.label}</span>
      <span style={{ color: props.color }}>{props.value}</span>
    </div>
  );
}

// ---- Bar row ----

export interface RowProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
  bar: number;
  barColor: string;
}

export function Row(props: RowProps): JSX.Element {
  return (
    <div class="perf-bar-row">
      <div class="perf-stat-row">
        <span class="perf-stat-label">{props.label}</span>
        <span class="perf-stat-value">
          <span style={{ color: props.color }}>{props.value}</span>
          {props.sub && <span class="perf-stat-sub">{props.sub}</span>}
        </span>
      </div>
      <div class="perf-bar-track">
        <div
          class="perf-bar-fill"
          style={{
            width: `${props.bar}%`,
            background: props.barColor,
          }}
        />
      </div>
    </div>
  );
}

// ---- Sparkline row (label + sparkline) ----

export interface SparklineRowProps {
  label: string;
  data: readonly number[];
  color: string;
  sparklineLabel: string;
}

export function SparklineRow(props: SparklineRowProps): JSX.Element {
  return (
    <div class="perf-stat-row" style={{ "margin-bottom": "2px" }}>
      <span class="perf-stat-label">{props.label}</span>
      <span class="perf-stat-value" style={{ display: "flex", "align-items": "center" }}>
        <Sparkline data={props.data} color={props.color} label={props.sparklineLabel} />
      </span>
    </div>
  );
}

// ---- Memory section (extracted to avoid non-null assertions in the parent) ----

export interface MemorySectionProps {
  memory: MemorySnapshot;
  heapHistory: readonly number[];
}

export function MemorySection(props: MemorySectionProps): JSX.Element {
  const m = props.memory;
  return (
    <>
      <Row
        label="JS Heap"
        value={`${fmt(m.heapUsedMB)} / ${fmt(m.heapLimitMB)} MB`}
        sub={`alloc ${fmt(m.heapTotalMB)} MB`}
        color={barColor(m.jsHeapPercent)}
        bar={m.jsHeapPercent}
        barColor={barColor(m.jsHeapPercent)}
      />
      <SparklineRow
        label="Heap trend"
        data={props.heapHistory}
        color={C_WARN}
        sparklineLabel="Heap trend"
      />
      <Stat
        label="Heap delta"
        value={`${m.heapDeltaMB >= 0 ? "+" : ""}${fmt(m.heapDeltaMB)} MB`}
        color={deltaColor(m.heapDeltaMB)}
      />
    </>
  );
}
