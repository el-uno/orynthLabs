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
