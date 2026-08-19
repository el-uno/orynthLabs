import { READINESS_DIMENSIONS, familyForKind } from "@/lib/types";
import type {
  LaunchRecommendation,
  Readiness,
  ReadinessDimension,
  Signal,
  SignalFamily
} from "@/lib/types";

/**
 * Multi-dimensional Launch Readiness.
 *
 * A single score cannot say *which axis* is holding a company back, and it
 * cannot express the outcome the product thesis treats as first-class: a good
 * product that should not tokenize yet. Readiness is therefore six scores plus
 * an explicit recommendation.
 */

/** Which evidence families speak to each axis. */
export const DIMENSION_FAMILIES: Record<ReadinessDimension, SignalFamily[]> = {
  product: ["builder", "consumer"],
  founder: ["builder"],
  market: ["capital", "market_structure"],
  community: ["attention"],
  distribution: ["attention", "consumer"],
  // Nothing observable speaks to token design; it comes from the Economic
  // Design Studio, which does not exist yet. Left empty so it scores null
  // rather than pretending to know.
  economicDesign: []
};

export const MIN_DIMENSIONS_FOR_RECOMMENDATION = 3;
export const LAUNCH_NOW_MIN_COMPOSITE = 75;
export const BUILD_FURTHER_MIN_COMPOSITE = 45;
/** A single signal this negative disqualifies a launch on its own. */
export const BLOCKING_DELTA = -10;

function familyOf(signal: Signal): SignalFamily {
  return signal.family ?? familyForKind(signal.kind);
}

/**
 * Scores one axis from the signals in its families.
 *
 * Returns null when no signal speaks to it. Null is not zero: an unresearched
 * community and an absent community are different findings, and scoring the
 * former as 0 would punish a company for our own lack of data.
 */
function scoreDimension(signals: Signal[], families: SignalFamily[]): number | null {
  if (families.length === 0) {
    return null;
  }

  const relevant = signals.filter((signal) => families.includes(familyOf(signal)));
  if (relevant.length === 0) {
    return null;
  }

  // Centre at 50 and move with the signed evidence, so a neutral reading is
  // neutral rather than zero.
  const net = relevant.reduce((total, signal) => total + signal.scoreDelta, 0);
  return Math.max(0, Math.min(100, 50 + net * 3));
}

export function assessReadiness(signals: Signal[]): Readiness {
  const readiness = {} as Readiness;
  for (const dimension of READINESS_DIMENSIONS) {
    readiness[dimension] = scoreDimension(signals, DIMENSION_FAMILIES[dimension]);
  }
  return readiness;
}

export type ReadinessAssessment = {
  readiness: Readiness;
  /** Mean of measured axes only; null when nothing is measured. */
  composite: number | null;
  /** How many of the six axes have any evidence behind them. */
  measuredDimensions: number;
  recommendation: LaunchRecommendation;
  reasons: string[];
};

export function compositeOf(readiness: Readiness): number | null {
  const measured = READINESS_DIMENSIONS.map((d) => readiness[d]).filter(
    (value): value is number => value !== null
  );

  if (measured.length === 0) {
    return null;
  }

  return Math.round(measured.reduce((a, b) => a + b, 0) / measured.length);
}

/**
 * Recommends whether to launch a token.
 *
 * Deliberately conservative: the default answer is "not yet". Advising a
 * founder to tokenize on thin evidence is the most costly mistake this system
 * can make, and the thesis is explicit that a token should amplify a working
 * product rather than substitute for one.
 */
export function assess(signals: Signal[]): ReadinessAssessment {
  const readiness = assessReadiness(signals);
  const composite = compositeOf(readiness);
  const measuredDimensions = READINESS_DIMENSIONS.filter((d) => readiness[d] !== null).length;
  const reasons: string[] = [];

  const blocking = signals.filter((s) => s.scoreDelta <= BLOCKING_DELTA).map((s) => s.label);

  if (measuredDimensions < MIN_DIMENSIONS_FOR_RECOMMENDATION || composite === null) {
    reasons.push(
      `only ${measuredDimensions} of 6 readiness dimensions have evidence; ` +
        `${MIN_DIMENSIONS_FOR_RECOMMENDATION} required before recommending`
    );
    return {
      readiness,
      composite,
      measuredDimensions,
      recommendation: "insufficient_evidence",
      reasons
    };
  }

  if (blocking.length > 0) {
    reasons.push(`disqualifying signal: ${blocking.join(", ")}`);
    return { readiness, composite, measuredDimensions, recommendation: "do_not_tokenize", reasons };
  }

  if (composite >= LAUNCH_NOW_MIN_COMPOSITE) {
    reasons.push(`composite ${composite} >= ${LAUNCH_NOW_MIN_COMPOSITE} across ${measuredDimensions} measured dimensions`);
    return { readiness, composite, measuredDimensions, recommendation: "launch_now", reasons };
  }

  if (composite >= BUILD_FURTHER_MIN_COMPOSITE) {
    const weakest = READINESS_DIMENSIONS.filter((d) => readiness[d] !== null).sort(
      (a, b) => (readiness[a] as number) - (readiness[b] as number)
    )[0];
    reasons.push(`composite ${composite} below ${LAUNCH_NOW_MIN_COMPOSITE}; weakest axis is ${weakest}`);
    return { readiness, composite, measuredDimensions, recommendation: "build_further", reasons };
  }

  reasons.push(`composite ${composite} below ${BUILD_FURTHER_MIN_COMPOSITE}: an onchain economy is not warranted yet`);
  return { readiness, composite, measuredDimensions, recommendation: "do_not_tokenize", reasons };
}
