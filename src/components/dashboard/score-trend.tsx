import type { ScoreTrend } from "@/lib/types";

/**
 * Inline sparkline. Rendered as SVG rather than a chart library: a handful of
 * points on a dashboard row does not justify a dependency, and this keeps the
 * table a server component.
 */
function Sparkline({ points, className }: { points: number[]; className: string }) {
  if (points.length < 2) {
    return null;
  }

  const width = 64;
  const height = 20;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min;

  const coords = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      // A flat series has no range to normalize against. Drawing it at the
      // baseline would read as a collapse to zero, so centre it instead.
      const y = range === 0 ? height / 2 : height - ((point - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={`Score history: ${points.join(", ")}`}
    >
      <polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const directionStyles = {
  up: "text-emerald-300",
  down: "text-rose-300",
  flat: "text-slate-400",
  new: "text-slate-500"
} as const;

export function ScoreTrendCell({ trend }: { trend?: ScoreTrend }) {
  if (!trend || trend.points.length === 0) {
    return <span className="text-sm text-slate-500">—</span>;
  }

  const tone = directionStyles[trend.direction];

  // One run is not a trend: say so rather than implying a measured zero change.
  if (trend.delta === null) {
    return <span className="text-sm text-slate-500">first run</span>;
  }

  const sign = trend.delta > 0 ? "+" : "";

  return (
    <div className={`flex items-center gap-2 ${tone}`}>
      <Sparkline points={trend.points} className={tone} />
      <span className="text-sm font-medium tabular-nums">
        {sign}
        {trend.delta}
      </span>
    </div>
  );
}
