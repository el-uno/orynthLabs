import { afterEach, describe, expect, it } from "vitest";
import { scoreLaunch } from "./scoring";
import { launches, signals } from "@/lib/mock-data";

// Pinned: the mock signals are dated 2026-08-17, and the threshold layer has a
// recency rule. Without a fixed clock these assertions would silently change
// meaning once wall-clock time drifted past the window.
const NOW = new Date("2026-08-18T12:00:00Z");

// launches[0] is an opportunity and launches[1] a company; they are assessed
// by different layers, so company assertions must use a company.
const company = launches.find((l) => l.entityKind === "company")!;
const opportunity = launches.find((l) => l.entityKind === "opportunity")!;

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe("scoreLaunch deterministic fallback", () => {
  it("falls back to a deterministic rationale without a key", async () => {
    const result = await scoreLaunch({ launch: company, signals, now: NOW });
    expect(result.rationale).toContain("OpenAI key not configured");
  });

  it("derives a company score from the readiness composite", async () => {
    const result = await scoreLaunch({ launch: company, signals, now: NOW });

    expect(result.score).toBe(result.assessment.composite);
    expect(result.score).not.toBe(company.score);
    expect(result.opportunity).toBeNull();
  });

  // The bug this replaced: with no model configured the fallback echoed
  // `launch.score`, that number gated the status (>= 75 => ready), and the
  // same value was written back to the row. A seeded 92 made an entity
  // "ready" with no evidence behind it — the row asserting its own readiness.
  it("is completely independent of the stored score", async () => {
    const inflated = await scoreLaunch({
      launch: { ...company, score: 100 },
      signals,
      now: NOW
    });
    const deflated = await scoreLaunch({
      launch: { ...company, score: 1 },
      signals,
      now: NOW
    });

    expect(inflated.score).toBe(deflated.score);
    expect(inflated.status).toBe(deflated.status);
    expect(inflated.assessment.recommendation).toBe(deflated.assessment.recommendation);
  });

  it("has no score at all when nothing is measurable", async () => {
    const result = await scoreLaunch({ launch: company, signals: [], now: NOW });

    expect(result.score).toBeNull();
    expect(result.assessment.recommendation).toBe("insufficient_evidence");
  });

  it("derives status from evidence rather than inheriting the stored one", async () => {
    const result = await scoreLaunch({ launch: company, signals, now: NOW });

    expect(result.statusDecision.reasons.length).toBeGreaterThan(0);
    expect(["draft", "watching", "ready", "launched"]).toContain(result.status);
  });

  it("produces a six-axis readiness assessment and a recommendation", async () => {
    const result = await scoreLaunch({ launch: launches[0], signals, now: NOW });

    expect(Object.keys(result.assessment.readiness)).toHaveLength(6);
    expect([
      "launch_now",
      "build_further",
      "do_not_tokenize",
      "insufficient_evidence"
    ]).toContain(result.assessment.recommendation);
  });

  it("maps every input signal to a scored signal", async () => {
    const result = await scoreLaunch({ launch: company, signals, now: NOW });
    expect(result.signals).toHaveLength(signals.length);
  });

  it("weights score deltas by severity", async () => {
    const result = await scoreLaunch({ launch: company, signals, now: NOW });

    const bySeverity = Object.fromEntries(
      result.signals.map((signal) => [signal.severity, signal.scoreDelta])
    );

    expect(bySeverity.high).toBe(8);
    expect(bySeverity.medium).toBe(4);
    expect(bySeverity.low).toBe(1);
  });

  it("produces output that satisfies the launch score schema", async () => {
    const result = await scoreLaunch({ launch: company, signals, now: NOW });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["draft", "watching", "ready", "launched"]).toContain(result.status);
  });

  it("assesses an opportunity on the gap, not on readiness axes", async () => {
    const result = await scoreLaunch({ launch: opportunity, signals, now: NOW });

    expect(result.opportunity).not.toBeNull();
    // The mock signals carry no market-structure evidence, so whether a gap
    // exists has not been examined and no score may be claimed.
    expect(result.opportunity!.verdict).toBe("insufficient_evidence");
    expect(result.score).toBeNull();
  });
});
