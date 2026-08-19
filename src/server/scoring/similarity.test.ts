import { describe, expect, it } from "vitest";
import { cosineSimilarity, dedupeBySimilarity } from "./similarity";
import type { Signal } from "@/lib/types";

function vec(seed: number, dims = 8): number[] {
  return Array.from({ length: dims }, (_, i) => Math.sin(seed + i));
}

function signal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: Math.random().toString(36).slice(2),
    source: "github",
    externalId: null,
    kind: "github",
    label: "l",
    severity: "medium",
    value: "v",
    detail: "d",
    scoreDelta: 4,
    timestamp: "2026-08-18T12:00:00Z",
    ...overrides
  };
}

describe("cosineSimilarity", () => {
  it("scores identical vectors at 1", () => {
    expect(cosineSimilarity(vec(1), vec(1))).toBeCloseTo(1, 6);
  });

  it("scores opposite vectors at -1", () => {
    const v = vec(1);
    expect(cosineSimilarity(v, v.map((x) => -x))).toBeCloseTo(-1, 6);
  });

  it("scores orthogonal vectors at 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("is scale invariant", () => {
    const v = vec(2);
    expect(cosineSimilarity(v, v.map((x) => x * 7))).toBeCloseTo(1, 6);
  });

  // A missing embedding means "cannot compare". Reading that as similar would
  // silently discard evidence, so it must score 0.
  it("returns 0 rather than throwing on absent or mismatched vectors", () => {
    expect(cosineSimilarity(null, vec(1))).toBe(0);
    expect(cosineSimilarity(vec(1), undefined)).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});

describe("dedupeBySimilarity", () => {
  it("collapses near-identical signals from different sources", () => {
    const shared = vec(5);
    const out = dedupeBySimilarity([
      signal({ source: "github", embedding: shared }),
      signal({ source: "helius", embedding: shared.map((x) => x * 1.001) })
    ]);
    expect(out).toHaveLength(1);
  });

  it("keeps similar signals that come from the SAME source", () => {
    // Two quiet weeks of commit activity read alike but are separate
    // observations; exact-identity dedup owns that case.
    const shared = vec(5);
    const out = dedupeBySimilarity([
      signal({ source: "github", embedding: shared }),
      signal({ source: "github", embedding: shared })
    ]);
    expect(out).toHaveLength(2);
  });

  it("keeps dissimilar signals from different sources", () => {
    const out = dedupeBySimilarity([
      signal({ source: "github", embedding: vec(1) }),
      signal({ source: "helius", embedding: vec(50) })
    ]);
    expect(out).toHaveLength(2);
  });

  it("is a no-op when embeddings are absent", () => {
    const out = dedupeBySimilarity([
      signal({ source: "github", embedding: null }),
      signal({ source: "helius", embedding: null }),
      signal({ source: "market", embedding: undefined })
    ]);
    expect(out).toHaveLength(3);
  });

  it("keeps the first occurrence when collapsing", () => {
    const shared = vec(9);
    const out = dedupeBySimilarity([
      signal({ id: "first", source: "github", embedding: shared }),
      signal({ id: "second", source: "helius", embedding: shared })
    ]);
    expect(out[0].id).toBe("first");
  });

  it("respects a custom threshold", () => {
    const a = signal({ source: "github", embedding: [1, 0] });
    const b = signal({ source: "helius", embedding: [0.7, 0.7] }); // ~0.707
    expect(dedupeBySimilarity([a, b], 0.9)).toHaveLength(2);
    expect(dedupeBySimilarity([a, b], 0.7)).toHaveLength(1);
  });
});
