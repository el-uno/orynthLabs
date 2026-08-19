import "server-only";
import { listLaunches } from "@/server/db/launches";
import { listSignals } from "@/server/db/signals";
import { listScoreHistoryFor } from "@/server/db/snapshots";
import { summarizeTrend } from "@/server/scoring/trend";
import {
  launches as fallbackLaunches,
  metricCards as fallbackMetrics,
  signals as fallbackSignals
} from "@/lib/mock-data";
import type { LaunchWithTrend, MetricCard, Signal } from "@/lib/types";

export type DashboardData = {
  launches: LaunchWithTrend[];
  signals: Signal[];
  metrics: MetricCard[];
  /** True when Supabase is unconfigured or empty and mock data is shown. */
  usingMockData: boolean;
};

function buildMetrics(launches: LaunchWithTrend[], signals: Signal[]): MetricCard[] {
  const ready = launches.filter((launch) => launch.status === "ready").length;
  const highPriority = signals.filter((signal) => signal.severity === "high").length;
  // Net movement across every launch that has been scored more than once.
  const moved = launches.filter((launch) => launch.trend?.delta != null);
  const movement =
    moved.length > 0
      ? moved.reduce((total, launch) => total + (launch.trend?.delta ?? 0), 0)
      : null;
  const averageScore =
    launches.length > 0
      ? Math.round(launches.reduce((total, launch) => total + launch.score, 0) / launches.length)
      : 0;

  return [
    { label: "Launches tracked", value: String(launches.length), delta: "live from database" },
    { label: "Signals ingested", value: String(signals.length), delta: "most recent 25" },
    {
      label: "High-priority alerts",
      value: String(highPriority),
      delta: highPriority > 0 ? "needs review" : "all clear"
    },
    {
      label: "Ready-for-launch",
      value: String(ready),
      delta: movement === null ? `avg score ${averageScore}` : `net ${movement > 0 ? "+" : ""}${movement} across scored launches`
    }
  ];
}

/**
 * Loads dashboard data from Supabase, falling back to mock data when the
 * database is unconfigured or still empty so the UI stays demoable.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const [storedLaunches, storedSignals] = await Promise.all([
    listLaunches(50),
    listSignals(25)
  ]);

  const hasLaunches = storedLaunches !== null && storedLaunches.length > 0;
  const hasSignals = storedSignals !== null && storedSignals.length > 0;

  if (!hasLaunches && !hasSignals) {
    return {
      launches: fallbackLaunches.map((launch) => ({ ...launch })),
      signals: fallbackSignals,
      metrics: fallbackMetrics,
      usingMockData: true
    };
  }

  const baseLaunches = hasLaunches ? storedLaunches : fallbackLaunches;
  const signals = hasSignals ? storedSignals : fallbackSignals;

  // One batched query for every launch's history, not one per row.
  const history = hasLaunches
    ? await listScoreHistoryFor(baseLaunches.map((launch) => launch.id))
    : new Map();

  const launches: LaunchWithTrend[] = baseLaunches.map((launch) => ({
    ...launch,
    trend: summarizeTrend(history.get(launch.id) ?? [])
  }));

  return {
    launches,
    signals,
    metrics: buildMetrics(launches, signals),
    usingMockData: false
  };
}
