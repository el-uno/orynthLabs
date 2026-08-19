import { describe, expect, it } from "vitest";
import { assess, assessReadiness, compositeOf } from "./readiness";
import type { Signal, SignalFamily } from "@/lib/types";

function signal(family: SignalFamily, scoreDelta = 8, overrides: Partial<Signal> = {}): Signal {
  return {
    id: Math.random().toString(36).slice(2),
    source: "test",
    externalId: null,
    kind: "github",
    family,
    label: "signal",
    severity: scoreDelta > 0 ? "high" : "high",
    value: "v",
    detail: "d",
    scoreDelta,
    timestamp: "2026-08-18T12:00:00Z",
    ...overrides
  };
}

describe("assessReadiness", () => {
  it("leaves unmeasured axes null rather than zero", () => {
    // Unmeasured and poor are different findings. Scoring an unresearched
    // community as 0 would punish a company for our own lack of data.
    const r = assessReadiness([signal("builder")]);
    expect(r.product).not.toBeNull();
    expect(r.founder).not.toBeNull();
    expect(r.community).toBeNull();
    expect(r.market).toBeNull();
  });

  it("never scores economic design, which has no observable source yet", () => {
    const r = assessReadiness([
      signal("builder"),
      signal("capital"),
      signal("attention"),
      signal("consumer")
    ]);
    expect(r.economicDesign).toBeNull();
  });

  it("moves an axis down on negative evidence", () => {
    const good = assessReadiness([signal("attention", 8)]);
    const bad = assessReadiness([signal("attention", -8)]);
    expect(bad.community!).toBeLessThan(good.community!);
  });

  it("keeps scores inside 0-100", () => {
    const extreme = assessReadiness(Array.from({ length: 40 }, () => signal("builder", 8)));
    expect(extreme.product).toBeLessThanOrEqual(100);
    const awful = assessReadiness(Array.from({ length: 40 }, () => signal("builder", -8)));
    expect(awful.product).toBeGreaterThanOrEqual(0);
  });
});

describe("compositeOf", () => {
  it("averages only measured axes", () => {
    const r = assessReadiness([signal("attention", 10)]);
    expect(compositeOf(r)).toBe(r.community);
  });

  it("is null when nothing is measured", () => {
    expect(compositeOf(assessReadiness([]))).toBeNull();
  });
});

describe("assess", () => {
  it("refuses to recommend on thin coverage", () => {
    const a = assess([signal("builder", 10)]);
    expect(a.recommendation).toBe("insufficient_evidence");
    expect(a.reasons[0]).toContain("readiness dimensions");
  });

  it("recommends launching only on broad, strong evidence", () => {
    const a = assess([
      signal("builder", 10),
      signal("capital", 10),
      signal("attention", 10),
      signal("consumer", 10)
    ]);
    expect(a.measuredDimensions).toBeGreaterThanOrEqual(3);
    expect(a.recommendation).toBe("launch_now");
  });

  it("says build further when coverage is broad but scores are middling", () => {
    const a = assess([
      signal("builder", 1),
      signal("capital", 1),
      signal("attention", 1),
      signal("consumer", 1)
    ]);
    expect(a.recommendation).toBe("build_further");
    expect(a.reasons.some((r) => r.includes("weakest axis"))).toBe(true);
  });

  // The outcome the previous model could not express at all.
  it("says do not tokenize when the evidence is broad but weak", () => {
    const a = assess([
      signal("builder", -6),
      signal("capital", -6),
      signal("attention", -6),
      signal("consumer", -6)
    ]);
    expect(a.recommendation).toBe("do_not_tokenize");
  });

  it("lets one disqualifying signal veto a launch outright", () => {
    const a = assess([
      signal("builder", 10),
      signal("capital", 10),
      signal("attention", 10),
      signal("consumer", 10),
      signal("builder", -20, { label: "GitHub repository archived" })
    ]);
    expect(a.recommendation).toBe("do_not_tokenize");
    expect(a.reasons.some((r) => r.includes("disqualifying"))).toBe(true);
  });

  it("always explains itself", () => {
    for (const signals of [[], [signal("builder")], [signal("builder"), signal("capital"), signal("attention")]]) {
      expect(assess(signals).reasons.length).toBeGreaterThan(0);
    }
  });
});
