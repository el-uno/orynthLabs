import type { ScorePoint, ScoreTrend } from "@/lib/types";

/**
 * Summarizes a launch's scoring history.
 *
 * `upsertLaunchScore` overwrites, so `launch_projects` only ever holds "now".
 * Every run has been recorded in `launch_snapshots` from the start — this reads
 * that back, so a score can be seen moving rather than just sitting there.
 */
export function summarizeTrend(history: ScorePoint[]): ScoreTrend {
  // Callers read newest-first from the database; plotting wants the reverse.
  const ordered = [...history].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const points = ordered.map((point) => point.score);

  if (points.length === 0) {
    return { current: null, previous: null, delta: null, direction: "new", points: [] };
  }

  const current = points[points.length - 1];

  // A single run is not a trend. Reporting delta 0 would imply "measured, and
  // unchanged", which is a different claim from "only measured once".
  if (points.length === 1) {
    return { current, previous: null, delta: null, direction: "new", points };
  }

  const previous = points[points.length - 2];
  const delta = current - previous;

  return {
    current,
    previous,
    delta,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    points
  };
}
