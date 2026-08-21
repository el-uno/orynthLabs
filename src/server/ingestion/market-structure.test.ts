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
  function run(candidates: Candidate[], topic = "agent treasury", lookupsCapped = false) {
    return normalizeMarketStructure({ topic, candidates, now: NOW, lookupsCapped });
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
      candidate("agent-treasury-a", 1000, "agent treasury"),
      candidate("agent-treasury-b", 1000, "agent treasury"),
      candidate("agent-treasury-c", 1000, "agent treasury")
    ];
    const concentration = run(dominated).find((s) => s.title === "Adoption concentration")!;
    expect(concentration.scoreDelta).toBeLessThan(0);
  });

  // Calibration across 16 live topics: at two incumbents one almost always
  // holds >70% of downloads, so the "category has an owner" penalty fired on
  // genuinely sparse markets. `mcp server framework` has two incumbents — an
  // open field — and scored a net NEGATIVE gap because of it.
  it("omits concentration below the incumbent floor", () => {
    for (const n of [1, 2, 3]) {
      const few = Array.from({ length: n }, (_, i) =>
        candidate(`agent-treasury-${i}`, 5000, "agent treasury")
      );
      expect(run(few).find((s) => s.title === "Adoption concentration")).toBeUndefined();
    }
  });

  it("does not let concentration turn a sparse market negative", () => {
    // Two incumbents, one dominant: the coverage bonus must survive.
    const sparse = [
      candidate("mcp-server-framework", 90_000, "mcp server framework"),
      candidate("mcp-server-lite", 800, "mcp server framework")
    ];
    const net = run(sparse, "mcp server framework").reduce((t, s) => t + s.scoreDelta, 0);
    expect(net).toBeGreaterThan(0);
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

describe("relevance scales with topic length", () => {
  // A flat 50% let a four-word topic qualify on two words:
  // `multi agent treasury coordination` returned six "incumbents" that were
  // generic agent and coordination packages.
  it("rejects a four-word topic matched on only two words", () => {
    const generic = [candidate("agent-coordination-kit", 9000, "coordination for agents")];
    expect(relevantCandidates(generic, "multi agent treasury coordination")).toHaveLength(0);
  });

  it("still accepts a package that genuinely covers the topic", () => {
    const real = [
      candidate("treasury-coord", 9000, "multi agent treasury coordination toolkit")
    ];
    expect(relevantCandidates(real, "multi agent treasury coordination")).toHaveLength(1);
  });

  it("stays lenient for short topics", () => {
    const short = [candidate("job-queue-x", 9000, "a queue")];
    expect(relevantCandidates(short, "job queue")).toHaveLength(1);
  });
});

describe("censored incumbent counts", () => {
  const one = (n: number) =>
    Array.from({ length: n }, (_, i) => candidate(`agent-treasury-${i}`, 5000, "agent treasury"));

  // MAX_DOWNLOAD_LOOKUPS caps how many candidates are ever measured, so busy
  // markets peg at the cap. Reporting that as an exact total made saturated
  // and mid-tier markets indistinguishable (10.8 vs 10.3 mean across 16 topics).
  it("reports a capped count as a floor, not a total", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      candidate(`agent-treasury-${i}`, 5000, "agent treasury")
    );
    const coverage = normalizeMarketStructure({
      topic: "agent treasury",
      candidates: many,
      lookupsCapped: true,
      now: NOW
    })[0];

    expect(coverage.value).toBe("12+ incumbents");
    expect(coverage.detail).toContain("at least");
    expect((coverage.raw as { countIsCensored: boolean }).countIsCensored).toBe(true);
  });

  it("reports an uncapped count exactly", () => {
    const coverage = normalizeMarketStructure({
      topic: "agent treasury",
      candidates: one(1),
      now: NOW
    })[0];
    expect(coverage.value).toBe("1 incumbent");
    expect((coverage.raw as { countIsCensored: boolean }).countIsCensored).toBe(false);
  });
});
