import { afterEach, describe, expect, it } from "vitest";
import { scoreLaunch } from "./scoring";
import { launches, signals } from "@/lib/mock-data";

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe("scoreLaunch deterministic fallback", () => {
  it("returns the launch's own score when no OpenAI key is configured", async () => {
    const launch = launches[0];
    const result = await scoreLaunch({ launch, signals });

    expect(result.score).toBe(launch.score);
    expect(result.status).toBe(launch.status);
    expect(result.rationale).toContain("OpenAI key not configured");
  });

  it("maps every input signal to a scored signal", async () => {
    const result = await scoreLaunch({ launch: launches[0], signals });
    expect(result.signals).toHaveLength(signals.length);
  });

  it("weights score deltas by severity", async () => {
    const result = await scoreLaunch({ launch: launches[0], signals });

    const bySeverity = Object.fromEntries(
      result.signals.map((signal) => [signal.severity, signal.scoreDelta])
    );

    expect(bySeverity.high).toBe(8);
    expect(bySeverity.medium).toBe(4);
    expect(bySeverity.low).toBe(1);
  });

  it("produces output that satisfies the launch score schema", async () => {
    const result = await scoreLaunch({ launch: launches[0], signals });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["draft", "watching", "ready", "launched"]).toContain(result.status);
  });
});
