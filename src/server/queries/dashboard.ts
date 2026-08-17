import "server-only";
import { listLaunches } from "@/server/db/launches";
import { listSignals } from "@/server/db/signals";
import {
  launches as fallbackLaunches,
  metricCards as fallbackMetrics,
  signals as fallbackSignals
} from "@/lib/mock-data";
import type { Launch, MetricCard, Signal } from "@/lib/types";

export type DashboardData = {
  launches: Launch[];
  signals: Signal[];
  metrics: MetricCard[];
  /** True when Supabase is unconfigured or empty and mock data is shown. */
  usingMockData: boolean;
};

function buildMetrics(launches: Launch[], signals: Signal[]): MetricCard[] {
  const ready = launches.filter((launch) => launch.status === "ready").length;
  const highPriority = signals.filter((signal) => signal.severity === "high").length;
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
    { label: "Ready-for-launch", value: String(ready), delta: `avg score ${averageScore}` }
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
      launches: fallbackLaunches,
      signals: fallbackSignals,
      metrics: fallbackMetrics,
      usingMockData: true
    };
  }

  const launches = hasLaunches ? storedLaunches : fallbackLaunches;
  const signals = hasSignals ? storedSignals : fallbackSignals;

  return {
    launches,
    signals,
    metrics: buildMetrics(launches, signals),
    usingMockData: false
  };
}
