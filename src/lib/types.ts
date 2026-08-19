export type SignalSeverity = "low" | "medium" | "high";

/** The source system a signal came from. */
export type SignalKind =
  | "github"
  | "social"
  | "market"
  | "onchain"
  | "partner";

/**
 * The kind of evidence a signal represents, independent of which API produced
 * it. These are the five signal families the product scans.
 *
 * Deliberately distinct from `SignalKind`: corroboration means agreement
 * between *independent kinds of evidence*, not between two APIs. Two market
 * vendors reporting the same liquidity move is one fact, not two, and the
 * intersection principle depends on telling those apart.
 */
export type SignalFamily =
  | "attention"
  | "builder"
  | "capital"
  | "consumer"
  | "market_structure";

export const SIGNAL_FAMILIES: SignalFamily[] = [
  "attention",
  "builder",
  "capital",
  "consumer",
  "market_structure"
];

/** Fallback for rows written before families were recorded. */
export function familyForKind(kind: SignalKind): SignalFamily {
  switch (kind) {
    case "github":
      return "builder";
    case "social":
      return "attention";
    case "market":
    case "onchain":
      return "capital";
    case "partner":
      return "market_structure";
  }
}

export type Signal = {
  id: string;
  /** Source system, e.g. "github" | "helius". */
  source?: string;
  /** Stable per-source identity, e.g. "owner/repo:commits:2026-08-18". */
  externalId?: string | null;
  kind: SignalKind;
  /** Absent on legacy rows; derive with `familyForKind`. */
  family?: SignalFamily | null;
  label: string;
  severity: SignalSeverity;
  value: string;
  detail: string;
  /**
   * Signed contribution. Severity alone says how *notable* a signal is, not
   * whether it is good or bad — an archived repo and a commit surge are both
   * "high". The sign is what distinguishes evidence from risk.
   */
  scoreDelta: number;
  /**
   * Populated only on the scoring read path — 1536 floats per row is far too
   * much payload for a dashboard render.
   */
  embedding?: number[] | null;
  timestamp: string;
};

/** Where an entity sits in our own tracking pipeline. */
export type LaunchStatus = "draft" | "watching" | "ready" | "launched";

/** An opportunity is a market gap with no company yet; a company is a real product. */
export type EntityKind = "opportunity" | "company";

/**
 * The six axes of Launch Readiness.
 *
 * `null` means unmeasured, and is never the same as 0. "We have not looked at
 * this company's community" and "this company has no community" are different
 * claims; collapsing them would make every unresearched entity look bad.
 */
export type ReadinessDimension =
  | "product"
  | "founder"
  | "market"
  | "community"
  | "distribution"
  | "economicDesign";

export const READINESS_DIMENSIONS: ReadinessDimension[] = [
  "product",
  "founder",
  "market",
  "community",
  "distribution",
  "economicDesign"
];

export type Readiness = Record<ReadinessDimension, number | null>;

/**
 * The tokenization decision.
 *
 * `do_not_tokenize` is a first-class outcome: a token should amplify a
 * product's economy, not replace it, so "good product, no token" must be
 * expressible. The previous model had no way to say it.
 */
export type LaunchRecommendation =
  | "launch_now"
  | "build_further"
  | "do_not_tokenize"
  | "insufficient_evidence";

/**
 * A tracked entity: a Build Opportunity, or a Company being built.
 *
 * Token fields are nullable. Most inputs are early-stage MVPs and live tools
 * with no token, and some should correctly never get one.
 */
export type Launch = {
  id: string;
  /** Stable identity that does not depend on a token existing. */
  slug: string;
  name: string;
  entityKind: EntityKind;
  symbol: string | null;
  status: LaunchStatus;
  score: number;
  chain: string | null;
  recommendation: LaunchRecommendation | null;
  readiness: Readiness;
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
  /** Which of the five evidence families this belongs to. */
  family: SignalFamily;
  severity: SignalSeverity;
  title: string;
  detail: string;
  value: string;
  scoreDelta: number;
  observedAt: string;
  raw: unknown;
};

/** One recorded scoring run. */
export type ScorePoint = {
  score: number;
  status: LaunchStatus;
  at: string;
};

export type TrendDirection = "up" | "down" | "flat" | "new";

export type ScoreTrend = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  direction: TrendDirection;
  /** Oldest to newest, for plotting. */
  points: number[];
};

export type LaunchWithTrend = Launch & { trend?: ScoreTrend };
