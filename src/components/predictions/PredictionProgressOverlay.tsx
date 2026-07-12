import { For, createMemo } from "solid-js";
import type {
  TwitchPredictionEvent,
  TwitchPredictionOutcome,
} from "~/services/predictions/twitchPredictions";
import "./PredictionProgressOverlay.css";

type PredictionProgressOverlayProps = {
  event: TwitchPredictionEvent | null;
  now: number;
};

type Segment = {
  outcome: TwitchPredictionOutcome;
  percent: number;
  pointsLabel: string;
};

const outcomeColors = [
  "#4873fb",
  "#f2009b",
  "#00ad96",
  "#ffb11f",
  "#8b5cf6",
  "#ef4444",
];

function compactNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function getRemainingSeconds(event: TwitchPredictionEvent, now: number): number | null {
  if (event.status !== "ACTIVE") return null;
  if (!event.createdAt || !event.predictionWindowSeconds) return null;

  const createdAt = Date.parse(event.createdAt);
  if (!Number.isFinite(createdAt)) return null;

  const endsAt = createdAt + event.predictionWindowSeconds * 1000;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";

  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return `${minutes}:${String(restSeconds).padStart(2, "0")}`;
}

function statusLabel(event: TwitchPredictionEvent): string {
  if (event.status === "ACTIVE") return "Прогноз";
  if (event.status === "LOCKED") return "Ставки закрыты";
  if (event.status === "RESOLVED") return "Прогноз завершён";
  if (event.status === "CANCELED") return "Прогноз отменён";
  return "Прогноз";
}

function segmentColor(outcome: TwitchPredictionOutcome, index: number): string {
  if (outcome.isWinner) return "#00c985";
  return outcomeColors[index % outcomeColors.length];
}

export function PredictionProgressOverlay(props: PredictionProgressOverlayProps) {
  const totalPoints = createMemo(() =>
    (props.event?.outcomes ?? []).reduce(
      (total, outcome) => total + outcome.totalPoints,
      0,
    ),
  );
  const segments = createMemo<Segment[]>(() => {
    const points = totalPoints();
    return (props.event?.outcomes ?? []).map((outcome) => ({
      outcome,
      percent: points > 0 ? Math.round((outcome.totalPoints / points) * 100) : 0,
      pointsLabel: compactNumber(outcome.totalPoints),
    }));
  });
  const remaining = createMemo(() =>
    props.event ? getRemainingSeconds(props.event, props.now) : null,
  );
  const hasEvent = createMemo(() => Boolean(props.event));

  return (
    <section
      class={`prediction-overlay ${hasEvent() ? "is-visible" : "is-hidden"}`}
    >
      {props.event && (
        <>
          <div class="prediction-meta">
            <span class="prediction-left">
              <span class="prediction-orb" />
              <span>{statusLabel(props.event)}</span>
            </span>
            <span class="prediction-title">{props.event.title}</span>
            <span
              class={`prediction-time ${
                props.event.status === "ACTIVE" ? "" : "is-muted"
              }`}
            >
              {props.event.status === "ACTIVE"
                ? formatDuration(remaining())
                : compactNumber(totalPoints())}
            </span>
          </div>
          <div class="prediction-bar">
            <For each={segments()}>
              {(segment, index) => (
                <div
                  class={`prediction-segment ${
                    segment.outcome.isWinner ? "is-winner" : ""
                  }`}
                  style={{
                    width: `${Math.max(segment.percent, 3)}%`,
                    "background-color": segmentColor(segment.outcome, index()),
                  }}
                >
                  {segment.outcome.badgeUrl && (
                    <img
                      class="prediction-badge"
                      src={segment.outcome.badgeUrl}
                      alt=""
                      aria-hidden="true"
                    />
                  )}
                  <span class="prediction-segment-text">
                    <span class="prediction-segment-title">
                      {segment.percent >= 14
                        ? segment.outcome.title
                        : index() + 1}
                    </span>
                    <span class="prediction-segment-value">
                      {segment.percent}% · {segment.pointsLabel}
                    </span>
                  </span>
                </div>
              )}
            </For>
          </div>
        </>
      )}
    </section>
  );
}

