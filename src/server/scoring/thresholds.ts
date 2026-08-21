import { familyForKind } from "@/lib/types";
import type { LaunchStatus, Signal } from "@/lib/types";

/**
 * Deterministic status transitions.
 *
 * The model produces a score and an explanation. It does NOT decide status:
 * left to itself it will return `ready` for a project with three low-severity
 * signals and no recent activity, because a language model has no notion of
 * evidentiary sufficiency. BUILD_PLAN.md asks that "low signal density leads to
 * draft or watching" — this module is that rule, and it is the layer that makes
 * scoring reproducible and arguable.
 */

/** A score alone is never enough for `ready`; it must be backed by evidence. */
export const READY_MIN_SCORE = 75;
export const READY_MIN_SIGNALS = 4;
/**
 * Signals that actually carry weight: medium-or-high severity AND a positive
 * contribution. Counting rows alone is not a sufficiency test — five "0 commits
 * this week" style readings are five pieces of evidence that nothing is
 * happening, and would otherwise clear a density gate on volume alone.
 */
export const READY_MIN_SUBSTANTIVE = 2;
/**
 * Corroboration across independent evidence *families*, not source systems.
 *
 * Counting sources measured agreement between APIs: two market-data vendors
 * reporting one liquidity move looked like two facts. The intersection
 * principle the product rests on — builder activity AND capital AND consumer
 * demand — is about families.
 */
export const READY_MIN_SOURCES = 2;
/** At least one signal must be recent, or "ready" reflects a stale world. */
export const READY_MAX_SIGNAL_AGE_DAYS = 14;

export const WATCHING_MIN_SCORE = 40;
export const WATCHING_MIN_SIGNALS = 2;

/**
 * A single signal at or below this delta blocks `ready` outright, regardless of
 * score. An archived repository (-20) or extreme holder concentration (-12) is
 * disqualifying on its own; it should not be averaged away by good news.
 */
export const BLOCKING_DELTA = -10;

export type Evidence = {
  signalCount: number;
  substantiveCount: number;
  distinctSources: number;
  highSeverityCount: number;
  riskCount: number;
  blockingRisks: string[];
  mostRecentAgeDays: number | null;
};

export type StatusDecision = {
  status: LaunchStatus;
  evidence: Evidence;
  /** Human-readable justification. Persisted so a status is always arguable. */
  reasons: string[];
};

export function summarizeEvidence(signals: Signal[], now: Date): Evidence {
  const ages = signals
    .map((signal) => Date.parse(signal.timestamp))
    .filter((t) => Number.isFinite(t))
    .map((t) => (now.getTime() - t) / 86400000);

  return {
    signalCount: signals.length,
    substantiveCount: signals.filter(
      (s) => s.scoreDelta > 0 && (s.severity === "high" || s.severity === "medium")
    ).length,
    distinctSources: new Set(
      signals.map((s) => s.family ?? familyForKind(s.kind))
    ).size,
    highSeverityCount: signals.filter((s) => s.severity === "high").length,
    riskCount: signals.filter((s) => s.scoreDelta < 0).length,
    blockingRisks: signals
      .filter((s) => s.scoreDelta <= BLOCKING_DELTA)
      .map((s) => s.label),
    mostRecentAgeDays: ages.length > 0 ? Math.min(...ages) : null
  };
}

/**
 * Resolves the status a launch has earned.
 *
 * `launched` is never inferred: it is a real-world fact someone recorded, and
 * no amount of signal analysis can establish or revoke it. If a launch is
 * already launched, it stays launched.
 */
export function resolveStatus(input: {
  /** The readiness composite. Null when no axis is measurable. */
  score: number | null;
  signals: Signal[];
  currentStatus?: LaunchStatus;
  now?: Date;
}): StatusDecision {
  const now = input.now ?? new Date();
  const evidence = summarizeEvidence(input.signals, now);
  const reasons: string[] = [];

  if (input.currentStatus === "launched") {
    return {
      status: "launched",
      evidence,
      reasons: ["already launched; status is a recorded fact, not an inference"]
    };
  }

  if (evidence.signalCount === 0) {
    return {
      status: "draft",
      evidence,
      reasons: ["no signals: nothing to assess regardless of score"]
    };
  }

  // No composite means no measurable axis. Readiness cannot be claimed on
  // evidence that does not exist, so this stops short of `watching` rather
  // than treating an absent score as a low one.
  if (input.score === null) {
    return {
      status: "draft",
      evidence,
      reasons: [
        `no readiness composite: ${evidence.signalCount} signal(s) but no measurable axis`
      ]
    };
  }

  const score = input.score;

  const isRecent =
    evidence.mostRecentAgeDays !== null &&
    evidence.mostRecentAgeDays <= READY_MAX_SIGNAL_AGE_DAYS;

  const readyChecks: { pass: boolean; detail: string }[] = [
    {
      pass: score >= READY_MIN_SCORE,
      detail: `score ${Math.round(score)} vs ${READY_MIN_SCORE} required`
    },
    {
      pass: evidence.signalCount >= READY_MIN_SIGNALS,
      detail: `${evidence.signalCount} signals vs ${READY_MIN_SIGNALS} required`
    },
    {
      pass: evidence.substantiveCount >= READY_MIN_SUBSTANTIVE,
      detail: `${evidence.substantiveCount} substantive signals vs ${READY_MIN_SUBSTANTIVE} required`
    },
    {
      pass: evidence.distinctSources >= READY_MIN_SOURCES,
      detail: `${evidence.distinctSources} distinct evidence families vs ${READY_MIN_SOURCES} required`
    },
    {
      pass: isRecent,
      detail:
        evidence.mostRecentAgeDays === null
          ? "no dated signals"
          : `newest signal is ${evidence.mostRecentAgeDays.toFixed(1)}d old, limit ${READY_MAX_SIGNAL_AGE_DAYS}d`
    },
    {
      pass: evidence.blockingRisks.length === 0,
      detail:
        evidence.blockingRisks.length > 0
          ? `blocking risk: ${evidence.blockingRisks.join(", ")}`
          : "no blocking risks"
    }
  ];

  const failed = readyChecks.filter((check) => !check.pass);

  if (failed.length === 0) {
    return {
      status: "ready",
      evidence,
      reasons: ["ready: " + readyChecks.map((c) => c.detail).join("; ")]
    };
  }

  reasons.push(...failed.map((check) => `not ready — ${check.detail}`));

  if (score >= WATCHING_MIN_SCORE || evidence.signalCount >= WATCHING_MIN_SIGNALS) {
    reasons.push(
      `watching: score ${Math.round(score)} >= ${WATCHING_MIN_SCORE} or ${evidence.signalCount} >= ${WATCHING_MIN_SIGNALS} signals`
    );
    return { status: "watching", evidence, reasons };
  }

  reasons.push(
    `draft: score ${Math.round(score)} below ${WATCHING_MIN_SCORE} and only ${evidence.signalCount} signal(s)`
  );
  return { status: "draft", evidence, reasons };
}
