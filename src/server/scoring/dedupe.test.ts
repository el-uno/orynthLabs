import { describe, expect, it } from "vitest";
import { dedupeByMetric, metricFamily } from "./dedupe";
import { resolveStatus } from "./thresholds";
import type { Signal } from "@/lib/types";

const NOW = new Date("2026-08-18T12:00:00Z");

function signal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: Math.random().toString(36).slice(2),
    source: "github",
    externalId: "owner/repo:commits:2026-08-18",
    kind: "github",
    label: "GitHub commit activity",
    severity: "medium",
    value: "v",
    detail: "d",
    scoreDelta: 4,
    timestamp: NOW.toISOString(),
    ...overrides
  };
}

function onDay(externalId: string, day: string, overrides: Partial<Signal> = {}) {
  return signal({
    externalId: `${externalId}:${day}`,
    timestamp: new Date(`${day}T12:00:00Z`).toISOString(),
    ...overrides
  });
}

describe("metricFamily", () => {
  it("strips the date bucket so daily readings share an identity", () => {
    expect(metricFamily(signal({ externalId: "owner/repo:commits:2026-08-18" }))).toBe(
      "owner/repo:commits"
    );
    expect(metricFamily(signal({ externalId: "owner/repo:commits:2026-08-19" }))).toBe(
      "owner/repo:commits"
    );
  });

  it("keeps distinct metrics distinct", () => {
    expect(metricFamily(signal({ externalId: "o/r:commits:2026-08-18" }))).not.toBe(
      metricFamily(signal({ externalId: "o/r:pull-requests:2026-08-18" }))
    );
  });

  it("keeps the same metric on different repos distinct", () => {
    expect(metricFamily(signal({ externalId: "a/x:commits:2026-08-18" }))).not.toBe(
      metricFamily(signal({ externalId: "b/y:commits:2026-08-18" }))
    );
  });

  it("falls back to source and label without an external id", () => {
    expect(metricFamily(signal({ externalId: null }))).toBe("github|GitHub commit activity");
  });
});

describe("dedupeByMetric", () => {
  it("keeps one reading per metric", () => {
    const acc = [
      onDay("o/r:commits", "2026-08-16"),
      onDay("o/r:commits", "2026-08-17"),
      onDay("o/r:commits", "2026-08-18")
    ];
    expect(dedupeByMetric(acc)).toHaveLength(1);
  });

  it("keeps the newest reading, not the first seen", () => {
    const acc = [
      onDay("o/r:commits", "2026-08-16", { value: "old" }),
      onDay("o/r:commits", "2026-08-18", { value: "new" }),
      onDay("o/r:commits", "2026-08-17", { value: "middle" })
    ];
    expect(dedupeByMetric(acc)[0].value).toBe("new");
  });

  it("does not collapse genuinely different metrics", () => {
    const acc = [
      onDay("o/r:commits", "2026-08-18"),
      onDay("o/r:pull-requests", "2026-08-18"),
      onDay("MINT:tx-activity", "2026-08-18", { source: "helius", kind: "onchain" })
    ];
    expect(dedupeByMetric(acc)).toHaveLength(3);
  });

  it("returns newest first", () => {
    const acc = [
      onDay("o/r:commits", "2026-08-16"),
      onDay("o/r:pull-requests", "2026-08-18")
    ];
    expect(dedupeByMetric(acc)[0].externalId).toContain("pull-requests");
  });

  it("handles an empty list", () => {
    expect(dedupeByMetric([])).toEqual([]);
  });
});

describe("regression: repeated sampling must not manufacture evidence", () => {
  // Measured against live data: one substantive signal reached `ready` after
  // two days of sweeps, purely because the same metric was sampled twice.
  const days = ["2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18"];
  const accumulated = days.flatMap((day) => [
    onDay("MINT:tx-activity", day, { source: "helius", kind: "onchain", severity: "high", scoreDelta: 8 }),
    onDay("o/r:commits", day, { severity: "low", scoreDelta: 1 }),
    onDay("o/r:pull-requests", day, { severity: "low", scoreDelta: 1 })
  ]);

  it("inflates evidence without dedup", () => {
    const d = resolveStatus({ score: 92, signals: accumulated, now: NOW });
    expect(d.evidence.substantiveCount).toBeGreaterThan(1);
    expect(d.status).toBe("ready");
  });

  it("holds the correct status once deduped", () => {
    const d = resolveStatus({ score: 92, signals: dedupeByMetric(accumulated), now: NOW });
    expect(d.evidence.signalCount).toBe(3);
    expect(d.evidence.substantiveCount).toBe(1);
    expect(d.status).toBe("watching");
  });
});
