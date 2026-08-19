import { describe, expect, it } from "vitest";
import {
  BLOCKING_DELTA,
  READY_MIN_SCORE,
  resolveStatus,
  summarizeEvidence
} from "./thresholds";
import type { Signal, SignalKind } from "@/lib/types";

const NOW = new Date("2026-08-18T12:00:00Z");

function signal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: Math.random().toString(36).slice(2),
    kind: "github",
    label: "signal",
    severity: "medium",
    value: "v",
    detail: "d",
    scoreDelta: 4,
    timestamp: new Date(NOW.getTime() - 86400000).toISOString(),
    ...overrides
  };
}

/** Four recent signals across four sources — the shape that earns `ready`. */
function strongEvidence(): Signal[] {
  const kinds: SignalKind[] = ["github", "social", "market", "onchain"];
  return kinds.map((kind) => signal({ kind, severity: "high", scoreDelta: 8 }));
}

describe("summarizeEvidence", () => {
  it("counts sources by kind, not by signal", () => {
    const e = summarizeEvidence([signal({ kind: "github" }), signal({ kind: "github" })], NOW);
    expect(e.signalCount).toBe(2);
    expect(e.distinctSources).toBe(1);
  });

  it("separates risk from severity", () => {
    const e = summarizeEvidence(
      [signal({ severity: "high", scoreDelta: 8 }), signal({ severity: "high", scoreDelta: -12 })],
      NOW
    );
    expect(e.highSeverityCount).toBe(2);
    expect(e.riskCount).toBe(1);
  });

  it("reports the age of the newest signal", () => {
    const e = summarizeEvidence(
      [
        signal({ timestamp: new Date(NOW.getTime() - 10 * 86400000).toISOString() }),
        signal({ timestamp: new Date(NOW.getTime() - 2 * 86400000).toISOString() })
      ],
      NOW
    );
    expect(e.mostRecentAgeDays).toBeCloseTo(2, 1);
  });
});

describe("resolveStatus", () => {
  it("awards ready when score and evidence both hold up", () => {
    const d = resolveStatus({ score: 92, signals: strongEvidence(), now: NOW });
    expect(d.status).toBe("ready");
  });

  it("refuses ready on a high score with no signals", () => {
    const d = resolveStatus({ score: 99, signals: [], now: NOW });
    expect(d.status).toBe("draft");
    expect(d.reasons[0]).toContain("no signals");
  });

  it("refuses ready on thin evidence despite a high score", () => {
    // The exact failure that motivated this layer: the model returning `ready`
    // for a project with almost nothing behind it.
    const d = resolveStatus({ score: 95, signals: [signal(), signal()], now: NOW });
    expect(d.status).toBe("watching");
    expect(d.reasons.some((r) => r.includes("signals vs"))).toBe(true);
  });

  it("refuses ready when every signal comes from one evidence family", () => {
    const oneSource = Array.from({ length: 6 }, () => signal({ kind: "github" }));
    const d = resolveStatus({ score: 95, signals: oneSource, now: NOW });
    expect(d.status).toBe("watching");
    expect(d.reasons.some((r) => r.includes("distinct evidence families"))).toBe(true);
  });

  it("refuses ready when the evidence is stale", () => {
    const stale = strongEvidence().map((s) => ({
      ...s,
      timestamp: new Date(NOW.getTime() - 40 * 86400000).toISOString()
    }));
    const d = resolveStatus({ score: 95, signals: stale, now: NOW });
    expect(d.status).toBe("watching");
    expect(d.reasons.some((r) => r.includes("old"))).toBe(true);
  });

  it("lets a single blocking risk veto ready", () => {
    const withRisk = [
      ...strongEvidence(),
      signal({ kind: "github", label: "GitHub repository archived", scoreDelta: -20 })
    ];
    const d = resolveStatus({ score: 95, signals: withRisk, now: NOW });
    expect(d.status).toBe("watching");
    expect(d.reasons.some((r) => r.includes("blocking risk"))).toBe(true);
  });

  it("does not treat a mild negative as blocking", () => {
    const mild = [...strongEvidence(), signal({ kind: "market", scoreDelta: BLOCKING_DELTA + 1 })];
    expect(resolveStatus({ score: 95, signals: mild, now: NOW }).status).toBe("ready");
  });

  it("drops to draft on a low score with a single signal", () => {
    const d = resolveStatus({ score: 10, signals: [signal()], now: NOW });
    expect(d.status).toBe("draft");
  });

  it("holds at watching on signal count alone when the score is low", () => {
    const d = resolveStatus({ score: 5, signals: [signal(), signal()], now: NOW });
    expect(d.status).toBe("watching");
  });

  it("never infers launched, and never revokes it", () => {
    const stayed = resolveStatus({
      score: 0,
      signals: [],
      currentStatus: "launched",
      now: NOW
    });
    expect(stayed.status).toBe("launched");

    // No amount of evidence promotes a project to launched.
    const promoted = resolveStatus({ score: 100, signals: strongEvidence(), now: NOW });
    expect(promoted.status).not.toBe("launched");
  });

  it("holds the ready score boundary exactly", () => {
    const at = resolveStatus({ score: READY_MIN_SCORE, signals: strongEvidence(), now: NOW });
    const below = resolveStatus({ score: READY_MIN_SCORE - 1, signals: strongEvidence(), now: NOW });
    expect(at.status).toBe("ready");
    expect(below.status).toBe("watching");
  });

  it("always explains itself", () => {
    for (const score of [0, 50, 95]) {
      const d = resolveStatus({ score, signals: strongEvidence(), now: NOW });
      expect(d.reasons.length).toBeGreaterThan(0);
      expect(d.reasons.every((r) => r.length > 0)).toBe(true);
    }
  });
});

describe("substantive evidence gate", () => {
  // Regression: the first cut of this layer counted rows, so five "nothing is
  // happening" readings cleared the density gate and returned `ready` for a
  // repository with zero commits and zero merged PRs.
  it("refuses ready when many signals are individually weak", () => {
    const weak: Signal[] = [
      signal({ kind: "onchain", severity: "high", scoreDelta: 8 }),
      signal({ kind: "onchain", severity: "low", scoreDelta: 0 }),
      signal({ kind: "github", severity: "low", scoreDelta: 1 }),
      signal({ kind: "github", severity: "low", scoreDelta: 1 }),
      signal({ kind: "github", severity: "low", scoreDelta: 1 })
    ];

    const d = resolveStatus({ score: 92, signals: weak, now: NOW });
    expect(d.status).toBe("watching");
    expect(d.reasons.some((r) => r.includes("substantive"))).toBe(true);
  });

  it("does not count a positive low-severity signal as substantive", () => {
    const e = summarizeEvidence(
      [signal({ severity: "low", scoreDelta: 5 }), signal({ severity: "medium", scoreDelta: 4 })],
      NOW
    );
    expect(e.substantiveCount).toBe(1);
  });

  it("does not count a negative high-severity signal as substantive", () => {
    const e = summarizeEvidence([signal({ severity: "high", scoreDelta: -12 })], NOW);
    expect(e.substantiveCount).toBe(0);
  });
});
