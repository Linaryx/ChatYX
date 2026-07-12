import { createSignal, type JSX } from "solid-js";
import type { CollectorSnapshot, SupportInfo } from "./perfCollector";
import { getSupport } from "./perfCollector";

// Export JSON schema version — bump on breaking changes
const EXPORT_SCHEMA_VERSION = 1;

export interface DiagnosticExport {
  schemaVersion: number;
  timestamp: string;
  currentSnapshot: CollectorSnapshot | null;
  environment: {
    userAgent: string;
    viewport: string;
    devicePixelRatio: number;
    online: boolean;
    visible: boolean;
  };
  supportMatrix: SupportInfo;
  historyLength: number;
}

/** Build a versioned diagnostic payload from current state */
export function buildExportPayload(
  snapshot: CollectorSnapshot | null,
  snapshots: readonly CollectorSnapshot[],
): DiagnosticExport {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    currentSnapshot: snapshot,
    environment: {
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      online: navigator.onLine,
      visible: !document.hidden,
    },
    supportMatrix: getSupport(),
    historyLength: snapshots.length,
  };
}

export interface PerfActionsProps {
  snapshot: CollectorSnapshot | null;
  snapshots: readonly CollectorSnapshot[];
}

type FeedbackState = "idle" | "copied" | "copy-failed" | "downloaded" | "download-failed";

const FEEDBACK_MESSAGES: Record<FeedbackState, string> = {
  idle: "",
  copied: "Diagnostics copied to clipboard",
  "copy-failed": "Copy failed. Try downloading instead.",
  downloaded: "Diagnostics downloaded",
  "download-failed": "Download failed",
};

export function PerfActions(props: PerfActionsProps): JSX.Element {
  const [feedback, setFeedback] = createSignal<FeedbackState>("idle");

  const handleCopy = async (): Promise<void> => {
    const payload = buildExportPayload(props.snapshot, props.snapshots);
    const json = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setFeedback("copied");
    } catch {
      setFeedback("copy-failed");
    }
  };

  const handleDownload = (): void => {
    const payload = buildExportPayload(props.snapshot, props.snapshots);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `perf-diagnostics-${Date.now()}.json`;
      anchor.click();
      setFeedback("downloaded");
      // Delay revoke to let the browser initiate the download
      setTimeout((): void => { URL.revokeObjectURL(url); }, 1000);
    } catch {
      setFeedback("download-failed");
      URL.revokeObjectURL(url);
    }
  };

  const feedbackMsg = (): string => FEEDBACK_MESSAGES[feedback()];

  return (
    <>
      <div class="perf-actions">
        <button
          type="button"
          class="perf-action-btn"
          onClick={handleCopy}
          aria-label="Copy performance diagnostics JSON"
        >
          Copy JSON
        </button>
        <button
          type="button"
          class="perf-action-btn"
          onClick={handleDownload}
          aria-label="Download performance diagnostics JSON file"
        >
          Download JSON
        </button>
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
      >
        {feedbackMsg()}
      </div>
      {/* Visible feedback for sighted users */}
      {feedback() !== "idle" && (
        <div
          style={{
            color: feedback() === "copy-failed" || feedback() === "download-failed"
              ? "#ef4444" : "#22c55e",
            "font-size": "9px",
            "margin-top": "3px",
            "text-align": "center",
          }}
        >
          {feedbackMsg()}
        </div>
      )}
    </>
  );
}
