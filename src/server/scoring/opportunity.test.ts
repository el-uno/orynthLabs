import { describe, expect, it } from "vitest";
import {
  MIN_DEMAND_FAMILIES,
  assessOpportunity,
  summarizeOpportunityEvidence
} from "./opportunity";
import { COVERAGE_SIGNAL_TITLE } from "@/server/ingestion/market-structure";
import type { Signal, SignalFamily } from "@/lib/types";

function signal(family: SignalFamily, scoreDelta = 8, label?: string): Signal {
  return {
    id: Math.random().toString(36).slice(2),
    source: "test",
    externalId: null,
    kind: "github",
    family,
    label: label ?? `${family} signal`,
    severity: "high",
    value: "v",
    detail: "d",
    scoreDelta,
    timestamp: "2026-08-19T12:00:00Z"
  };
}

/**
 * A gap is established by the coverage signal specifically. Staleness and
 * fragmentation are also market_structure but cannot create scarcity.
 */
const gap = () => signal("market_structure", 10, COVERAGE_SIGNAL_TITLE);
const served = () => signal("market_structure", -8, COVERAGE_SIGNAL_TITLE);
/** A market_structure signal that is NOT coverage. */
const staleness = () => signal("market_structure", 8, "Incumbent staleness");

describe("summarizeOpportunityEvidence", () => {
  it("counts a family as demand only when its net contribution is positive", () => {
    const e = summarizeOpportunityEvidence([signal("builder", 8), signal("builder", -10)]);
    expect(e.demandFamilies).not.toContain("builder");
  });

  it("excludes market_structure from demand — it is the gap, not the demand", () => {
    const e = summarizeOpportunityEvidence([gap()]);
    expect(e.demandFamilies).toEqual([]);
    expect(e.gapStrength).toBe(10);
  });

  it("distinguishes an unexamined gap from a closed one", () => {
    expect(summarizeOpportunityEvidence([signal("builder")]).gapExamined).toBe(false);
    expect(summarizeOpportunityEvidence([served()]).gapExamined).toBe(true);
  });
});

describe("assessOpportunity", () => {
  it("has no verdict without signals", () => {
    const a = assessOpportunity([]);
    expect(a.verdict).toBe("insufficient_evidence");
    expect(a.score).toBeNull();
  });

  // Not looking is not the same as finding nothing. The central claim of an
  // opportunity is that solutions are scarce; without market-structure
  // evidence that claim is unsupported.
  it("refuses to score when the gap has never been examined", () => {
    const a = assessOpportunity([signal("builder"), signal("capital"), signal("consumer")]);
    expect(a.verdict).toBe("insufficient_evidence");
    expect(a.score).toBeNull();
    expect(a.reasons[0]).toContain("has not been examined");
  });

  // The rule that stops the engine recommending crowded markets.
  it("calls a well-served market crowded however strong the demand", () => {
    const a = assessOpportunity([
      signal("builder", 10),
      signal("capital", 10),
      signal("consumer", 10),
      signal("attention", 10),
      served()
    ]);
    expect(a.verdict).toBe("crowded");
    expect(a.reasons.some((r) => r.includes("not an opportunity"))).toBe(true);
  });

  it("gives a crowded market a score, since it is a finding not a gap in data", () => {
    const a = assessOpportunity([signal("builder", 10), signal("capital", 10), served()]);
    expect(a.score).not.toBeNull();
  });

  it("requires demand from more than one family", () => {
    const a = assessOpportunity([signal("builder", 10), gap()]);
    expect(a.verdict).toBe("insufficient_evidence");
    expect(a.reasons[0]).toContain(`${MIN_DEMAND_FAMILIES} required`);
  });

  it("calls a broad, strong intersection a strong opportunity", () => {
    const a = assessOpportunity([
      signal("builder", 10),
      signal("capital", 10),
      signal("consumer", 10),
      signal("attention", 10),
      gap()
    ]);
    expect(a.verdict).toBe("strong");
    expect(a.score).toBeGreaterThanOrEqual(70);
    expect(a.reasons[0]).toContain("gap observed");
  });

  it("calls a narrow intersection emerging rather than strong", () => {
    const a = assessOpportunity([signal("builder", 1), signal("capital", 1), gap()]);
    expect(a.verdict).toBe("emerging");
    expect(a.score).toBeLessThan(70);
  });

  it("rewards breadth of demand over volume from one family", () => {
    const broad = assessOpportunity([
      signal("builder", 4),
      signal("capital", 4),
      signal("consumer", 4),
      gap()
    ]);
    const narrow = assessOpportunity([
      signal("builder", 6),
      signal("builder", 6),
      signal("capital", 1),
      gap()
    ]);
    expect(broad.score!).toBeGreaterThan(narrow.score!);
  });

  it("keeps scores inside 0-100", () => {
    const extreme = assessOpportunity([
      ...Array.from({ length: 20 }, () => signal("builder", 10)),
      ...Array.from({ length: 20 }, () => signal("capital", 10)),
      signal("market_structure", 200)
    ]);
    expect(extreme.score!).toBeLessThanOrEqual(100);
  });

  it("always explains itself", () => {
    for (const signals of [[], [signal("builder")], [signal("builder"), signal("capital"), gap()]]) {
      expect(assessOpportunity(signals).reasons.length).toBeGreaterThan(0);
    }
  });
});

describe("regression: evidence must belong to the entity", () => {
  // Scoring read `signal_events` globally, so an opportunity holding only
  // market-structure signals borrowed another entity's builder, capital and
  // consumer evidence and claimed a "strong" intersection that had never been
  // observed for it. Three companies with different repositories also scored
  // identically. Signals are now fetched per project_id.
  it("cannot claim an intersection from one family's evidence alone", () => {
    const ownSignalsOnly = [gap(), gap(), gap()];
    const a = assessOpportunity(ownSignalsOnly);

    expect(a.verdict).toBe("insufficient_evidence");
    expect(a.score).toBeNull();
    expect(a.evidence.demandFamilies).toEqual([]);
  });
});

describe("only coverage can establish a gap", () => {
  // `react state management` has eight incumbents, so coverage said "well
  // served" (-4) — but staleness (+4) and fragmentation (+4) outvoted it, the
  // net went positive, and a saturated market read as an opportunity.
  it("refuses a gap when coverage is negative, whatever the modifiers say", () => {
    const a = assessOpportunity([
      served(),
      staleness(),
      staleness(),
      signal("builder", 8),
      signal("attention", 8)
    ]);

    expect(a.verdict).toBe("crowded");
    expect(a.evidence.gapStrength).toBeGreaterThan(0);
    expect(a.evidence.coverageStrength).toBeLessThan(0);
  });

  it("still recognises a gap that coverage supports", () => {
    const a = assessOpportunity([gap(), signal("builder", 8), signal("attention", 8)]);
    expect(["strong", "emerging"]).toContain(a.verdict);
  });
});
