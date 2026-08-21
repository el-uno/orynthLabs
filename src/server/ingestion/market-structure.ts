import type { NpmPackage } from "@/server/clients/npm";
import type { ObservedSignal, SignalSeverity } from "@/lib/types";

export const MARKET_SOURCE = "npm";

/**
 * Title of the signal that answers "do solutions already exist?".
 *
 * Exported so the opportunity gate can key on it rather than on the net of
 * every market-structure signal. Staleness and fragmentation describe how
 * attractive a gap is; they must not be able to manufacture one.
 */
export const COVERAGE_SIGNAL_TITLE = "Existing solution coverage";

/**
 * A package only counts as a competitor if someone actually uses it. Without a
 * floor, a market looks crowded because forty abandoned experiments share a
 * keyword.
 */
export const CREDIBLE_MIN_WEEKLY_DOWNLOADS = 500;

/** Published longer ago than this and an incumbent is not being maintained. */
export const STALE_MONTHS = 12;

/** Above this share of adoption, one incumbent effectively owns the category. */
export const DOMINANCE_THRESHOLD = 0.7;

/**
 * Incumbents required before concentration is measured at all.
 *
 * Calibrated against 16 live topics. At two incumbents one of them almost
 * always holds more than 70% of downloads, so the "category has an owner"
 * penalty fired on genuinely sparse markets and swamped the scarcity bonus:
 * `mcp server framework` has two incumbents — an open field — yet scored a net
 * negative gap. It was the only case where the incumbent count and the gap
 * contradicted each other, and it was systematic rather than noise.
 */
export const MIN_INCUMBENTS_FOR_CONCENTRATION = 4;

/**
 * Share of the topic's meaningful terms a package must mention to count as
 * addressing it.
 *
 * The registry ranks on keyword relevance, so a multi-word query returns
 * packages matching any single term: "solana agent treasury policy" surfaces
 * `@solana/errors` and `@open-policy-agent/opa-wasm`, which solve neither the
 * problem nor anything near it. Filtering on downloads alone made this worse,
 * not better — it selects for popularity, and the popular matches are the
 * generic ones. Relevance has to be established before adoption is consulted.
 */
/**
 * Terms a package must match to count as addressing the topic.
 *
 * Scales with topic length. A flat 50% let a four-word topic qualify on two
 * words: `multi agent treasury coordination` returned six "incumbents" that
 * were generic agent and coordination packages, none of which address treasury
 * coordination. Longer topics are more specific, so they demand more overlap.
 */
export function requiredTermHits(termCount: number): number {
  if (termCount <= 2) return 1;
  if (termCount === 3) return 2;
  return 3;
}

/** Retained for reporting; relevance itself is decided by `requiredTermHits`. */
export const MIN_TERM_COVERAGE = 0.5;

/**
 * Relevance filtering is a heuristic and admits some false positives:
 * `@open-policy-agent/opa-wasm` covers "agent" and "policy" for a query about
 * agent treasury policy without addressing it. Term coverage cannot tell a
 * compound name from a subject match. Treat coverage counts as directional,
 * and calibrate the thresholds against a real topic list before trusting the
 * absolute numbers.
 */

/** Words that carry no discriminating power in a package search. */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "for",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "with",
  "management",
  "manager",
  "tool",
  "tools",
  "library",
  "sdk",
  "api",
  "framework",
]);

export function topicTerms(topic: string): string[] {
  return topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOPWORDS.has(term));
}

/**
 * Fraction of the topic's terms the package mentions in its name or
 * description.
 */
export function termCoverage(pkg: NpmPackage, terms: string[]): number {
  if (terms.length === 0) {
    return 1;
  }

  const haystack = `${pkg.name} ${pkg.description ?? ""}`.toLowerCase();
  const hits = terms.filter((term) => haystack.includes(term)).length;
  return hits / terms.length;
}

/** Packages that plausibly address the whole topic, not one word of it. */
export function relevantCandidates(
  candidates: Candidate[],
  topic: string,
): Candidate[] {
  const terms = topicTerms(topic);
  if (terms.length === 0) {
    return candidates;
  }

  const needed = requiredTermHits(terms.length);
  return candidates.filter(
    (c) => Math.round(termCoverage(c.pkg, terms) * terms.length) >= needed,
  );
}

export type Candidate = {
  pkg: NpmPackage;
  weeklyDownloads: number | null;
};

export type MarketStructureInput = {
  topic: string;
  candidates: Candidate[];
  /** How many results the search returned before relevance narrowed them. */
  examined?: number;
  /**
   * True when relevance produced more candidates than adoption lookups allow.
   * The incumbent count is then a floor, not a total.
   */
  lookupsCapped?: boolean;
  now?: Date;
};

function dayBucket(now: Date) {
  return now.toISOString().slice(0, 10);
}

function monthsSince(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  return (now.getTime() - then) / (1000 * 60 * 60 * 24 * 30.44);
}

/**
 * A real competitor addresses the topic *and* has real adoption. Relevance is
 * applied first: without it, adoption filtering promotes generic packages that
 * merely share a keyword.
 */
export function credibleIncumbents(
  candidates: Candidate[],
  topic: string,
): Candidate[] {
  return relevantCandidates(candidates, topic).filter(
    (c) => (c.weeklyDownloads ?? 0) >= CREDIBLE_MIN_WEEKLY_DOWNLOADS,
  );
}

/**
 * Turns a market reading into observed signals.
 *
 * **The sign convention inverts in this family.** Everywhere else, more
 * activity is better. Here, an absence of maintained solutions is the *positive*
 * finding — it is the "existing solution coverage: low" claim that every Build
 * Opportunity rests on. A crowded, well-served market is the negative signal.
 */
export function normalizeMarketStructure(
  input: MarketStructureInput,
): ObservedSignal[] {
  const now = input.now ?? new Date();
  const bucket = dayBucket(now);
  const topicKey = input.topic.toLowerCase().replace(/\s+/g, "-");
  const incumbents = credibleIncumbents(input.candidates, input.topic);
  const signals: ObservedSignal[] = [];

  // 1. Solution coverage — the core market-gap claim.
  const count = incumbents.length;
  const censored = input.lookupsCapped === true && count === input.candidates.length;
  let coverageSeverity: SignalSeverity;
  let coverageDelta: number;
  let coverageNote: string;

  if (count <= 1) {
    coverageSeverity = "high";
    coverageDelta = 10;
    coverageNote = "few maintained solutions exist: an open gap";
  } else if (count <= 4) {
    coverageSeverity = "medium";
    coverageDelta = 4;
    coverageNote = "a handful of maintained solutions: room remains";
  } else if (count <= 9) {
    coverageSeverity = "medium";
    coverageDelta = -4;
    coverageNote = "well served: differentiation required";
  } else {
    coverageSeverity = "high";
    // Deliberately kept above the blocking magnitude. A crowded market is a
    // serious negative but it is not disqualifying the way a dead product or
    // rug-level holder concentration is — companies enter crowded markets on
    // differentiation all the time. At -10 it tripped the veto and turned a
    // strong company into "do not tokenize" on competition alone.
    coverageDelta = -8;
    coverageNote = "crowded: entering costs more than it returns";
  }

  signals.push({
    source: MARKET_SOURCE,
    externalId: `${topicKey}:solution-coverage:${bucket}`,
    kind: "market",
    family: "market_structure",
    severity: coverageSeverity,
    title: COVERAGE_SIGNAL_TITLE,
    detail: censored
      ? `at least ${count} maintained package(s) above ${CREDIBLE_MIN_WEEKLY_DOWNLOADS} weekly downloads (adoption lookups capped) — ${coverageNote}`
      : `${count} maintained package(s) above ${CREDIBLE_MIN_WEEKLY_DOWNLOADS} weekly downloads — ${coverageNote}`,
    value: censored ? `${count}+ incumbents` : `${count} incumbent${count === 1 ? "" : "s"}`,
    scoreDelta: coverageDelta,
    observedAt: now.toISOString(),
    raw: {
      topic: input.topic,
      candidatesExamined: input.examined ?? input.candidates.length,
      relevantCandidates: relevantCandidates(input.candidates, input.topic)
        .length,
      credibleIncumbents: count,
      countIsCensored: censored,
      threshold: CREDIBLE_MIN_WEEKLY_DOWNLOADS,
      names: incumbents.map((c) => c.pkg.name),
    },
  });

  // 2. Incumbent staleness — an unmaintained leader is itself the gap.
  if (count > 0) {
    const ages = incumbents.map((c) => monthsSince(c.pkg.date, now));
    const dated = ages.filter((a): a is number => a !== null);
    const stale = dated.filter((a) => a > STALE_MONTHS).length;
    const staleShare = dated.length > 0 ? stale / dated.length : 0;
    const staleSeverity: SignalSeverity =
      staleShare >= 0.6 ? "high" : staleShare >= 0.3 ? "medium" : "low";

    signals.push({
      source: MARKET_SOURCE,
      externalId: `${topicKey}:incumbent-staleness:${bucket}`,
      kind: "market",
      family: "market_structure",
      severity: staleSeverity,
      title: "Incumbent staleness",
      detail: `${stale} of ${dated.length} incumbent(s) unpublished for over ${STALE_MONTHS} months`,
      value: `${Math.round(staleShare * 100)}% stale`,
      // Stale incumbents are an opening, so the delta is positive.
      scoreDelta: staleShare >= 0.6 ? 8 : staleShare >= 0.3 ? 4 : 0,
      observedAt: now.toISOString(),
      raw: {
        staleCount: stale,
        datedCount: dated.length,
        staleShare,
        staleMonths: STALE_MONTHS,
      },
    });

    // 3. Adoption concentration — is the category already owned?
    // Below MIN_INCUMBENTS_FOR_CONCENTRATION a dominant share is arithmetic
    // rather than evidence, and reads as an entrenched monopoly where the real
    // finding is that the field is open.
    if (count >= MIN_INCUMBENTS_FOR_CONCENTRATION) {
      const downloads = incumbents.map((c) => c.weeklyDownloads ?? 0);
      const total = downloads.reduce((a, b) => a + b, 0);
      const leader = Math.max(...downloads);
      const share = total > 0 ? leader / total : 0;
      const dominated = share >= DOMINANCE_THRESHOLD;

      signals.push({
        source: MARKET_SOURCE,
        externalId: `${topicKey}:adoption-concentration:${bucket}`,
        kind: "market",
        family: "market_structure",
        severity: dominated ? "high" : "medium",
        title: "Adoption concentration",
        detail: dominated
          ? `One incumbent holds ${Math.round(share * 100)}% of adoption: the category has an owner`
          : `Leader holds ${Math.round(share * 100)}% of adoption: demand is fragmented`,
        value: `${Math.round(share * 100)}% leader share`,
        // A dominant incumbent is a barrier; fragmentation is an opening.
        scoreDelta: dominated ? -8 : 4,
        observedAt: now.toISOString(),
        raw: {
          leaderShare: share,
          leaderDownloads: leader,
          totalDownloads: total,
          incumbents: incumbents.map((c) => ({
            name: c.pkg.name,
            weeklyDownloads: c.weeklyDownloads,
          })),
        },
      });
    }
  }

  return signals;
}
