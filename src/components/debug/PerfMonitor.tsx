import { createSignal, onCleanup, onMount, type JSX } from "solid-js";
import type { CollectorSnapshot } from "./perfCollector";
import { start as collectorStart, stop as collectorStop, subscribe } from "./perfCollector";
import { PerfPanel } from "./PerfPanel";

export interface PerfMonitorProps {
  /** Connection state from the chat service (optional — wired in Todo 5) */
  readonly isConnected?: boolean;
}

/**
 * Performance monitor overlay — small orchestrator that wires the collector
 * to the panel. Mounted only when the `debug=true` URL param is active.
 */
export function PerfMonitor(props: PerfMonitorProps): JSX.Element {
  const [visible, setVisible] = createSignal(true);
  const [snapshot, setSnapshot] = createSignal<CollectorSnapshot | null>(null);
  const [snapshots, setSnapshots] = createSignal<CollectorSnapshot[]>([]);

  onMount(() => {
    collectorStart();
    const unsub = subscribe((s: CollectorSnapshot) => {
      setSnapshot(s);
      setSnapshots((prev) => {
        const next = [...prev, s];
        return next.length > 60 ? next.slice(-60) : next;
      });
    });
    onCleanup(() => {
      unsub();
      collectorStop();
    });
  });

  return (
    <div class="perf-overlay">
      <button
        type="button"
        class="perf-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible() ? "Collapse performance panel" : "Expand performance panel"}
        aria-expanded={visible()}
      >
        {visible() ? "▼ perf" : "▶ perf"}
      </button>
      {(() => {
        if (!visible()) return null;
        const s = snapshot();
        if (s === null) return null;
        return (
          <PerfPanel
            snapshot={s}
            snapshots={snapshots()}
            isConnected={props.isConnected}
          />
        );
      })()}
    </div>
  );
}
