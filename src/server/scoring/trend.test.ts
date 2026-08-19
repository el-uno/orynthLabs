import { describe, expect, it } from "vitest";
import { summarizeTrend } from "./trend";
import type { ScorePoint } from "@/lib/types";

function point(score: number, day: number): ScorePoint {
  return {
    score,
    status: "watching",
    at: new Date(`2026-08-${String(day).padStart(2, "0")}T12:00:00Z`).toISOString()
  };
}

describe("summarizeTrend", () => {
  it("reports nothing for an empty history", () => {
    const t = summarizeTrend([]);
    expect(t).toEqual({ current: null, previous: null, delta: null, direction: "new", points: [] });
  });

  // "First run" and "measured, unchanged" are different claims. A single point
  // must not report delta 0, which would imply the latter.
  it("does not invent a delta from a single run", () => {
    const t = summarizeTrend([point(80, 18)]);
    expect(t.current).toBe(80);
    expect(t.previous).toBeNull();
    expect(t.delta).toBeNull();
    expect(t.direction).toBe("new");
  });

  it("orders oldest-to-newest for plotting, whatever the input order", () => {
    const newestFirst = [point(90, 18), point(70, 16), point(80, 17)];
    expect(summarizeTrend(newestFirst).points).toEqual([70, 80, 90]);
  });

  it("computes a rise", () => {
    const t = summarizeTrend([point(90, 18), point(75, 17)]);
    expect(t.current).toBe(90);
    expect(t.previous).toBe(75);
    expect(t.delta).toBe(15);
    expect(t.direction).toBe("up");
  });

  it("computes a fall", () => {
    const t = summarizeTrend([point(60, 18), point(75, 17)]);
    expect(t.delta).toBe(-15);
    expect(t.direction).toBe("down");
  });

  it("reports flat when two runs agree", () => {
    const t = summarizeTrend([point(92, 18), point(92, 17)]);
    expect(t.delta).toBe(0);
    expect(t.direction).toBe("flat");
  });

  it("compares only the two most recent runs", () => {
    const t = summarizeTrend([point(50, 14), point(60, 15), point(95, 16), point(90, 17)]);
    expect(t.current).toBe(90);
    expect(t.previous).toBe(95);
    expect(t.delta).toBe(-5);
    expect(t.points).toEqual([50, 60, 95, 90]);
  });
});
