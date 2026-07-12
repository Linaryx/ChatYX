import type { JSX } from "solid-js";

export interface SparklineProps {
  /** Data points, most recent last. Rendered right-to-left */
  data: readonly number[];
  /** SVG width in px (default: 60) */
  width?: number;
  /** SVG height in px (default: 20) */
  height?: number;
  /** Stroke color (default: #22c55e) */
  color?: string;
  /** Explicit maximum value for Y-axis scaling. Auto if omitted */
  max?: number;
  /** Accessible label */
  label?: string;
}

const DEFAULT_WIDTH = 60;
const DEFAULT_HEIGHT = 20;
const DEFAULT_COLOR = "#22c55e";
const MIN_RANGE = 1;

/**
 * Lightweight SVG sparkline for compact 60-second trend visualization.
 * Renders right-to-left so the latest value is at the right edge.
 * Falls back to an empty SVG when fewer than 2 data points exist.
 */
export function Sparkline(props: SparklineProps): JSX.Element {
  const {
    data,
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    color = DEFAULT_COLOR,
    max: explicitMax,
    label,
  } = props;

  // Need at least 2 points for a visible line
  if (data.length < 2) {
    return (
      <svg
        class="perf-sparkline-svg"
        width={width}
        height={height}
        aria-label={label ?? "sparkline"}
        role="img"
      />
    );
  }

  // Scale data to SVG height
  const dataMax = explicitMax ?? Math.max(...data);
  const range = dataMax > 0 ? dataMax : MIN_RANGE;
  const stepX = width / Math.max(data.length - 1, 1);

  const points: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const x = width - i * stepX; // right-to-left: newest at right
    const y = height - (data[i] / range) * height;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  return (
    <svg
      class="perf-sparkline-svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={label ?? "sparkline"}
      role="img"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        stroke-width="1"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  );
}
