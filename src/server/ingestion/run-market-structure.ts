import { fetchWeeklyDownloads, searchNpmPackages } from "@/server/clients/npm";
import {
  normalizeMarketStructure,
  relevantCandidates,
  type Candidate
} from "./market-structure";
import type { ObservedSignal } from "@/lib/types";

/** How many search results to examine before filtering. */
export const CANDIDATE_POOL = 20;

/**
 * Cap on download lookups per reading.
 *
 * Relevance filtering usually cuts the pool well below this; the cap exists so
 * a broad topic cannot fan out into dozens of requests.
 */
export const MAX_DOWNLOAD_LOOKUPS = 12;

/**
 * Thin IO wrapper. Fetches a market reading and hands it to the pure
 * normalizer, which holds every judgement.
 *
 * Relevance is applied *before* download lookups, not after. It is a local
 * computation over data already in hand, while adoption costs one request per
 * package — so filtering first is both the correct order conceptually (a
 * package that does not address the topic is not a competitor however popular
 * it is) and the difference between two requests and twenty.
 */
export async function ingestMarketStructure(input: {
  topic: string;
  poolSize?: number;
  now?: Date;
}): Promise<ObservedSignal[]> {
  const packages = await searchNpmPackages(input.topic, input.poolSize ?? CANDIDATE_POOL);

  const pool: Candidate[] = packages.map((pkg) => ({ pkg, weeklyDownloads: null }));
  const relevant = relevantCandidates(pool, input.topic).slice(0, MAX_DOWNLOAD_LOOKUPS);

  // Download figures come one package at a time; the bulk endpoint cannot
  // handle scoped names, which are common exactly where new infrastructure is.
  const measured: Candidate[] = [];
  for (const candidate of relevant) {
    measured.push({
      pkg: candidate.pkg,
      weeklyDownloads: await fetchWeeklyDownloads(candidate.pkg.name)
    });
  }

  return normalizeMarketStructure({
    topic: input.topic,
    // Unmeasured packages are still reported as examined, so the signal can say
    // how wide the search was before relevance narrowed it.
    candidates: measured,
    examined: packages.length,
    now: input.now ?? new Date()
  });
}
