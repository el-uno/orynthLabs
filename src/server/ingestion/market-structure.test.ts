import { describe, expect, it } from "vitest";
import {
  CREDIBLE_MIN_WEEKLY_DOWNLOADS,
  credibleIncumbents,
  normalizeMarketStructure,
  relevantCandidates,
  termCoverage,
  topicTerms,
  type Candidate
} from "./market-structure";

const NOW = new Date("2026-08-19T12:00:00Z");

function pkg(name: string, description = "", monthsOld = 1): Candidate["pkg"] {
  return {
    name,
    description,
    date: new Date(NOW.getTime() - monthsOld * 30.44 * 86400000).toISOString()
  };
}

function candidate(
  name: string,
  downloads: number | null,
  description = "",
  monthsOld = 1
): Candidate {
  return { pkg: pkg(name, description, monthsOld), weeklyDownloads: downloads };
}

describe("topicTerms", () => {
  it("drops stopwords and short tokens", () => {
    expect(topicTerms("agent treasury management for the sdk")).toEqual(["agent", "treasury"]);
  });
});

describe("termCoverage", () => {
  it("scores a package that addresses the whole topic", () => {
    const terms = topicTerms("solana agent treasury");
    expect(termCoverage(pkg("solana-agent-treasury", "treasury for solana agents"), terms)).toBe(1);
  });

  // The failure that motivated relevance filtering: registry search returns
  // packages matching a single term, and adoption filtering then promotes them
  // precisely because generic packages are popular.
  it("scores down a package matching only one term", () => {
    const terms = topicTerms("solana agent treasury policy");
    expect(termCoverage(pkg("@solana/errors", "error types"), terms)).toBeLessThan(0.5);
  });
});

describe("relevantCandidates", () => {
  it("excludes keyword-only matches", () => {
    const pool = [
      candidate("solana-agent-treasury", 900, "treasury policy for solana agents"),
      candidate("@solana/errors", 2_000_000, "error types")
    ];
    const relevant = relevantCandidates(pool, "solana agent treasury policy");
    expect(relevant.map((c) => c.pkg.name)).toEqual(["solana-agent-treasury"]);
  });
});

describe("credibleIncumbents", () => {
  it("requires both relevance and real adoption", () => {
    const pool = [
      candidate("agent-treasury-pro", 5000, "agent treasury"),
      candidate("agent-treasury-toy", 3, "agent treasury"),
      candidate("unrelated-thing", 900_000, "something else")
    ];
    expect(credibleIncumbents(pool, "agent treasury").map((c) => c.pkg.name)).toEqual([
      "agent-treasury-pro"
    ]);
  });

  it("treats a missing download figure as not credible", () => {
    const pool = [candidate("agent-treasury-x", null, "agent treasury")];
    expect(credibleIncumbents(pool, "agent treasury")).toHaveLength(0);
  });
});

describe("normalizeMarketStructure — sign convention", () => {
  function run(candidates: Candidate[], topic = "agent treasury") {
    return normalizeMarketStructure({ topic, candidates, now: NOW });
  }

  // In every other family more activity is better. Here, an absence of
  // maintained solutions is the positive finding — it is the "existing
  // solution coverage: low" claim a Build Opportunity rests on.
  it("treats an empty market as a POSITIVE signal", () => {
    const coverage = run([])[0];
    expect(coverage.scoreDelta).toBeGreaterThan(0);
    expect(coverage.severity).toBe("high");
    expect(coverage.detail).toContain("open gap");
  });

  it("treats a crowded market as a NEGATIVE signal", () => {
    const crowded = Array.from({ length: 12 }, (_, i) =>
      candidate(`agent-treasury-${i}`, 5000, "agent treasury")
    );
    const coverage = run(crowded)[0];
    expect(coverage.scoreDelta).toBeLessThan(0);
    expect(coverage.detail).toContain("crowded");
  });

  // Regression: at -10 this tripped the readiness veto, so a strong company in
  // a busy category was recommended against on competition alone.
  it("does not make a crowded market disqualifying", async () => {
    const { BLOCKING_DELTA } = await import("@/server/scoring/readiness");
    const crowded = Array.from({ length: 12 }, (_, i) =>
      candidate(`agent-treasury-${i}`, 5000, "agent treasury")
    );
    expect(run(crowded)[0].scoreDelta).toBeGreaterThan(BLOCKING_DELTA);
  });

  it("tags every signal to the market_structure family", () => {
    const signals = run([candidate("agent-treasury-a", 5000, "agent treasury")]);
    expect(signals.every((s) => s.family === "market_structure")).toBe(true);
  });

  it("treats stale incumbents as an opening", () => {
    const stale = [
      candidate("agent-treasury-old", 5000, "agent treasury", 30),
      candidate("agent-treasury-old2", 5000, "agent treasury", 26)
    ];
    const staleness = run(stale).find((s) => s.title === "Incumbent staleness")!;
    expect(staleness.scoreDelta).toBeGreaterThan(0);
    expect(staleness.value).toBe("100% stale");
  });

  it("treats a dominant incumbent as a barrier", () => {
    const dominated = [
      candidate("agent-treasury-big", 100_000, "agent treasury"),
      candidate("agent-treasury-small", 1000, "agent treasury")
    ];
    const concentration = run(dominated).find((s) => s.title === "Adoption concentration")!;
    expect(concentration.scoreDelta).toBeLessThan(0);
  });

  // "100% leader share" of a single package is arithmetic, not evidence, and
  // would read as an entrenched monopoly where the finding is an empty field.
  it("omits concentration entirely below two incumbents", () => {
    const single = run([candidate("agent-treasury-only", 5000, "agent treasury")]);
    expect(single.find((s) => s.title === "Adoption concentration")).toBeUndefined();
    expect(single.map((s) => s.title)).toEqual([
      "Existing solution coverage",
      "Incumbent staleness"
    ]);
  });

  it("gives signals a topic- and day-scoped external id", () => {
    const ids = run([candidate("agent-treasury-a", 5000, "agent treasury")]).map(
      (s) => s.externalId
    );
    expect(ids[0]).toBe("agent-treasury:solution-coverage:2026-08-19");
  });

  it("honours the adoption floor exactly", () => {
    const at = run([candidate("agent-treasury-a", CREDIBLE_MIN_WEEKLY_DOWNLOADS, "agent treasury")]);
    const below = run([
      candidate("agent-treasury-a", CREDIBLE_MIN_WEEKLY_DOWNLOADS - 1, "agent treasury")
    ]);
    expect(at[0].value).toBe("1 incumbent");
    expect(below[0].value).toBe("0 incumbents");
  });
});
