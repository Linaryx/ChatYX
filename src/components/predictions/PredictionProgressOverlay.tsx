import { For, createMemo } from "solid-js";
import type {
  TwitchPredictionEvent,
  TwitchPredictionOutcome,
} from "~/services/predictions/twitchPredictions";
import { getPublicAssetUrl } from "~/utils/appBase";
import "./PredictionProgressOverlay.css";

export type PredictionOverlayVariant = "standalone" | "chat";

type PredictionProgressOverlayProps = {
  event: TwitchPredictionEvent | null;
  now: number;
  variant?: PredictionOverlayVariant;
};

type Segment = {
  outcome: TwitchPredictionOutcome;
  percent: number;
  pointsLabel: string;
  color: string;
  labelColor: string;
};

const ROPE_COLORS = [
  { fill: "#4873fb", label: "rgba(255,255,255,0.92)" },
  { fill: "#f2009b", label: "rgba(255,255,255,0.92)" },
  { fill: "#00ad96", label: "rgba(255,255,255,0.92)" },
  { fill: "#ffb11f", label: "rgba(255,255,255,0.95)" },
  { fill: "#8b5cf6", label: "rgba(255,255,255,0.92)" },
  { fill: "#ef4444", label: "rgba(255,255,255,0.92)" },
  { fill: "#0891b2", label: "rgba(255,255,255,0.92)" },
  { fill: "#c2410c", label: "rgba(255,255,255,0.92)" },
  { fill: "#4d7c0f", label: "rgba(255,255,255,0.92)" },
  { fill: "#be185d", label: "rgba(255,255,255,0.92)" },
];

const WINNER_COLOR = { fill: "#00c985", label: "rgba(255,255,255,0.95)" };
const predictionOrbSrc = getPublicAssetUrl("predictions/magic-ball.svg");

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
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

function statusLabel(event: TwitchPredictionEvent): string {
  if (event.status === "ACTIVE") return "Прогноз";
  if (event.status === "LOCKED") return "Ставки закрыты";
  if (event.status === "RESOLVED") return "Прогноз завершён";
  if (event.status === "CANCELED") return "Прогноз отменён";
  return "Прогноз";
}

function paletteFor(
  outcome: TwitchPredictionOutcome,
  index: number,
) {
  if (outcome.isWinner) return WINNER_COLOR;
  return ROPE_COLORS[index % ROPE_COLORS.length];
}

export function PredictionProgressOverlay(props: PredictionProgressOverlayProps) {
  const variant = () => props.variant ?? "standalone";
  const totalPoints = createMemo(() =>
    (props.event?.outcomes ?? []).reduce(
      (total, outcome) => total + outcome.totalPoints,
      0,
    ),
  );
  const segments = createMemo<Segment[]>(() => {
    const outcomes = props.event?.outcomes ?? [];
    const count = outcomes.length;
    const points = totalPoints();

    // Even split (eq. ratios) while nobody has put points yet.
    if (count === 0) return [];
    if (points <= 0) {
      const base = Math.floor(100 / count);
      let remainder = 100 - base * count;
      return outcomes.map((outcome, index) => {
        const percent = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        const palette = paletteFor(outcome, index);
        return {
          outcome,
          percent,
          pointsLabel: compactNumber(outcome.totalPoints),
          color: palette.fill,
          labelColor: palette.label,
        };
      });
    }

    // Largest-remainder so displayed % always sum to 100.
    const raw = outcomes.map((outcome) => (outcome.totalPoints / points) * 100);
    const floors = raw.map((value) => Math.floor(value));
    let leftover = 100 - floors.reduce((sum, value) => sum + value, 0);
    const order = raw
      .map((value, index) => ({ index, frac: value - floors[index] }))
      .sort((a, b) => b.frac - a.frac);
    const percents = [...floors];
    for (const entry of order) {
      if (leftover <= 0) break;
      percents[entry.index] += 1;
      leftover -= 1;
    }

    return outcomes.map((outcome, index) => {
      const palette = paletteFor(outcome, index);
      return {
        outcome,
        percent: percents[index],
        pointsLabel: compactNumber(outcome.totalPoints),
        color: palette.fill,
        labelColor: palette.label,
      };
    });
  });
  const remaining = createMemo(() =>
    props.event ? getRemainingSeconds(props.event, props.now) : null,
  );
  const hasEvent = createMemo(() => Boolean(props.event));
  const outcomeCount = createMemo(() => props.event?.outcomes.length ?? 0);
  const sharesLabel = createMemo(() =>
    segments()
      .map((segment) => {
        const title = segment.outcome.title.trim() || "Без названия";
        const winner = segment.outcome.isWinner ? ", победитель" : "";
        return `${title}: ${segment.percent}%, ${segment.pointsLabel} баллов${winner}`;
      })
      .join("; "),
  );
  // Keep index + percent readable: more outcomes → tighter min.
  const minSegmentPx = createMemo(() => {
    const n = Math.max(outcomeCount(), 1);
    if (variant() === "chat") {
      if (n <= 2) return 64;
      if (n === 3) return 52;
      if (n === 4) return 44;
      return 36;
    }
    if (n <= 2) return 88;
    if (n === 3) return 72;
    if (n === 4) return 60;
    return 48;
  });

  return (
    <section
      class={`prediction-overlay prediction-overlay--${variant()} ${hasEvent() ? "is-visible" : "is-hidden"} ${
        outcomeCount() > 2 ? "is-multi" : "is-versus"
      }`}
      aria-hidden={!hasEvent()}
    >
      {props.event && (
        <>
          <div class="prediction-meta">
            <span class="prediction-left">
              <img
                class="prediction-orb"
                src={predictionOrbSrc}
                alt=""
                aria-hidden="true"
              />
              <span class="prediction-status">{statusLabel(props.event)}</span>
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

          <div
            class="prediction-bar"
            role="list"
            aria-label={`Доли ставок: ${sharesLabel()}`}
          >
            <For each={segments()}>
              {(segment, index) => {
                const outcomeTitle =
                  segment.outcome.title.trim() || `Вариант ${index() + 1}`;
                return (
                  <div
                    role="listitem"
                    aria-label={`${outcomeTitle}: ${segment.percent}%, ${segment.pointsLabel} баллов${
                      segment.outcome.isWinner ? ", победитель" : ""
                    }`}
                    class={`prediction-segment ${
                      segment.outcome.isWinner ? "is-winner" : ""
                    }`}
                    style={{
                      flex: `${Math.max(segment.percent, 1)} 1 0`,
                      "min-width": `min(${minSegmentPx()}px, calc((100% - ${(outcomeCount() - 1) * 3}px) / ${outcomeCount()}))`,
                      "background-color": segment.color,
                      "--prediction-label-color": segment.labelColor,
                    }}
                  >
                    <span class="prediction-segment-text">
                      <span class="prediction-segment-label">
                        {outcomeTitle}:
                      </span>
                      <span class="prediction-segment-value">
                        {segment.percent}%
                        {variant() === "standalone" && outcomeCount() <= 2
                          ? ` · ${segment.pointsLabel}`
                          : ""}
                      </span>
                    </span>
                  </div>
                );
              }}
            </For>
          </div>
        </>
      )}
    </section>
  );
}

export function createPreviewPredictionEvent(
  now = Date.now(),
): TwitchPredictionEvent {
  return {
    id: "preview-prediction",
    title: "Кто победит в раунде?",
    status: "ACTIVE",
    createdAt: new Date(now - 34_000).toISOString(),
    lockedAt: null,
    endedAt: null,
    predictionWindowSeconds: 120,
    winningOutcomeId: null,
    outcomes: [
      {
        id: "blue",
        title: "Синие",
        color: "BLUE",
        totalPoints: 128_400,
        totalUsers: 214,
        badgeUrl: "",
        isWinner: false,
      },
      {
        id: "pink",
        title: "Розовые",
        color: "PINK",
        totalPoints: 86_250,
        totalUsers: 173,
        badgeUrl: "",
        isWinner: false,
      },
    ],
    updatedAt: now,
    source: "gql",
  };
}
