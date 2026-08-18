export type SignalSeverity = "low" | "medium" | "high";

export type SignalKind =
  | "github"
  | "social"
  | "market"
  | "onchain"
  | "partner";

export type Signal = {
  id: string;
  kind: SignalKind;
  label: string;
  severity: SignalSeverity;
  value: string;
  detail: string;
  timestamp: string;
};

export type LaunchStatus = "draft" | "watching" | "ready" | "launched";

export type Launch = {
  id: string;
  name: string;
  symbol: string;
  status: LaunchStatus;
  score: number;
  chain: "Solana";
  updatedAt: string;
};

export type MetricCard = {
  label: string;
  value: string;
  delta: string;
};

/**
 * A fact observed in the world, normalized from an external source.
 *
 * Distinct from scoring output: scoring output is an artifact of a scoring run
 * and lives on `launch_snapshots.payload`. Only observed signals are stored in
 * `signal_events`, so scoring can never consume its own output.
 */
export type ObservedSignal = {
  source: string;
  /** Stable per-source identity. Re-ingesting the same fact updates one row. */
  externalId: string;
  kind: SignalKind;
  severity: SignalSeverity;
  title: string;
  detail: string;
  value: string;
  scoreDelta: number;
  observedAt: string;
  raw: unknown;
};
