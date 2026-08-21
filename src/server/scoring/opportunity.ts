import { familyForKind } from "@/lib/types";
import type { OpportunityVerdict, Signal, SignalFamily } from "@/lib/types";

/**
 * Build Opportunity assessment.
 *
 * A company is judged on readiness — does it have a product, a founder, a
 * community. An opportunity has none of those yet, so it is judged on a
 * different question entirely: **is there a gap worth building into?**
 *
 * The thesis is explicit about what that takes. A single trending signal is
 * weak evidence; strength comes from an intersection:
 *
 *   developer activity ↑ AND capital flowing ↑ AND consumer demand ↑
 *   AND existing products inadequate
 *
 * Two rules follow, and both are hard gates rather than score contributions:
 *
 * 1. **Demand must be corroborated across families.** One family enthusing
 *    about itself is not an intersection.
 * 2. **A gap must actually be observed.** High activity in a well-served
 *    market is not an opportunity — it is a crowded market, and building into
 *    it costs more than it returns. Without market-structure evidence we have
 *    not looked for the gap, which is not the same as having found one.
 */

/** Families whose positive evidence counts as demand. */
export const DEMAND_FAMILIES: SignalFamily[] = [
  "attention",
  "builder",
  "capital",
  "consumer"
];

/** Distinct demand families required before an intersection is claimed. */
export const MIN_DEMAND_FAMILIES = 2;

/** Score at or above which an opportunity is called strong. */
export const STRONG_MIN_SCORE = 70;

export type OpportunityEvidence = {
  /** Demand families showing net positive evidence. */
  demandFamilies: SignalFamily[];
  /** Summed positive contribution across demand families. */
  demandStrength: number;
  /** Net market-structure contribution. Positive means solutions are scarce. */
  gapStrength: number;
  /** False when no market-structure signal exists: the gap is unexamined. */
  gapExamined: boolean;
  signalCount: number;
};

export type OpportunityAssessment = {
  score: number | null;
  verdict: OpportunityVerdict;
  evidence: OpportunityEvidence;
  reasons: string[];
};

function familyOf(signal: Signal): SignalFamily {
  return signal.family ?? familyForKind(signal.kind);
}

export function summarizeOpportunityEvidence(signals: Signal[]): OpportunityEvidence {
  const netByFamily = new Map<SignalFamily, number>();
  for (const signal of signals) {
    const family = familyOf(signal);
    netByFamily.set(family, (netByFamily.get(family) ?? 0) + signal.scoreDelta);
  }

  const demandFamilies = DEMAND_FAMILIES.filter((family) => (netByFamily.get(family) ?? 0) > 0);
  const demandStrength = demandFamilies.reduce(
    (total, family) => total + (netByFamily.get(family) ?? 0),
    0
  );

  return {
    demandFamilies,
    demandStrength,
    gapStrength: netByFamily.get("market_structure") ?? 0,
    gapExamined: netByFamily.has("market_structure"),
    signalCount: signals.length
  };
}

/**
 * Scores an opportunity from the strength of the intersection.
 *
 * Derived, never invented or supplied — the same discipline the readiness
 * composite follows. Demand breadth matters more than any single loud family,
 * so breadth is weighted directly rather than folded into the sum.
 */
function deriveScore(evidence: OpportunityEvidence): number {
  const breadth = evidence.demandFamilies.length * 10;
  const demand = Math.min(evidence.demandStrength, 30);
  const gap = Math.min(evidence.gapStrength, 20);
  return Math.max(0, Math.min(100, 30 + breadth + demand + gap));
}

export function assessOpportunity(signals: Signal[]): OpportunityAssessment {
  const evidence = summarizeOpportunityEvidence(signals);
  const reasons: string[] = [];

  if (evidence.signalCount === 0) {
    return {
      score: null,
      verdict: "insufficient_evidence",
      evidence,
      reasons: ["no signals: nothing to assess"]
    };
  }

  // Not looking is not the same as finding nothing. Without market-structure
  // evidence the central claim of an opportunity — that solutions are scarce —
  // is unsupported, so no score is produced at all.
  if (!evidence.gapExamined) {
    return {
      score: null,
      verdict: "insufficient_evidence",
      evidence,
      reasons: [
        "no market-structure evidence: whether a gap exists has not been examined"
      ]
    };
  }

  // A well-served market is a finding, not a missing measurement — so it gets
  // a score and an explicit verdict rather than being filed as unknown.
  if (evidence.gapStrength <= 0) {
    return {
      score: deriveScore(evidence),
      verdict: "crowded",
      evidence,
      reasons: [
        `existing solutions already serve this space (market-structure net ${evidence.gapStrength})`,
        "demand without a gap is a competitive market, not an opportunity"
      ]
    };
  }

  if (evidence.demandFamilies.length < MIN_DEMAND_FAMILIES) {
    return {
      score: null,
      verdict: "insufficient_evidence",
      evidence,
      reasons: [
        `demand seen in ${evidence.demandFamilies.length} family (${evidence.demandFamilies.join(", ") || "none"}); ` +
          `${MIN_DEMAND_FAMILIES} required before calling it an intersection`
      ]
    };
  }

  const score = deriveScore(evidence);
  reasons.push(
    `gap observed (market-structure net +${evidence.gapStrength}) with demand across ` +
      `${evidence.demandFamilies.length} families: ${evidence.demandFamilies.join(", ")}`
  );

  if (score >= STRONG_MIN_SCORE) {
    reasons.push(`score ${score} >= ${STRONG_MIN_SCORE}: worth building into`);
    return { score, verdict: "strong", evidence, reasons };
  }

  reasons.push(`score ${score} below ${STRONG_MIN_SCORE}: watch rather than act`);
  return { score, verdict: "emerging", evidence, reasons };
}
