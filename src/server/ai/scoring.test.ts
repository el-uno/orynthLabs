import { afterEach, describe, expect, it } from "vitest";
import { scoreLaunch } from "./scoring";
import { launches, signals } from "@/lib/mock-data";

// Pinned: the mock signals are dated 2026-08-17, and the threshold layer has a
// recency rule. Without a fixed clock these assertions would silently change
// meaning once wall-clock time drifted past the window.
const NOW = new Date("2026-08-18T12:00:00Z");

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe("scoreLaunch deterministic fallback", () => {
  it("returns the launch's own score when no OpenAI key is configured", async () => {
    const launch = launches[0];
    const result = await scoreLaunch({ launch, signals, now: NOW });

    expect(result.score).toBe(launch.score);
    expect(result.rationale).toContain("OpenAI key not configured");
  });

  it("derives status from evidence rather than inheriting the stored one", async () => {
    // The stored status is an input, not an answer. The threshold layer exists
    // precisely so a recorded status cannot assert readiness the evidence does
    // not support — in either direction.
    const launch = launches[0];
    const result = await scoreLaunch({ launch, signals, now: NOW });

    expect(result.statusDecision.reasons.length).toBeGreaterThan(0);
    expect(["draft", "watching", "ready", "launched"]).toContain(result.status);
    expect(result.status).not.toBe(launch.status);
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
    const result = await scoreLaunch({ launch: launches[0], signals, now: NOW });
    expect(result.signals).toHaveLength(signals.length);
  });

  it("weights score deltas by severity", async () => {
    const result = await scoreLaunch({ launch: launches[0], signals, now: NOW });

    const bySeverity = Object.fromEntries(
      result.signals.map((signal) => [signal.severity, signal.scoreDelta])
    );

    expect(bySeverity.high).toBe(8);
    expect(bySeverity.medium).toBe(4);
    expect(bySeverity.low).toBe(1);
  });

  it("produces output that satisfies the launch score schema", async () => {
    const result = await scoreLaunch({ launch: launches[0], signals, now: NOW });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["draft", "watching", "ready", "launched"]).toContain(result.status);
  });
});
