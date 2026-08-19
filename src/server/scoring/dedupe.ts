import type { Signal } from "@/lib/types";

/**
 * Collapses repeated readings of the same metric.
 *
 * Ingestion buckets external ids by UTC day, which is correct for storage — it
 * preserves a time series. It is wrong for scoring: the threshold layer counts
 * signals as evidence, so the same metric sampled on four consecutive days
 * reads as four independent corroborating facts. Measured against live data, a
 * launch with one substantive signal reached `ready` after two days of sweeps
 * without anything new happening.
 *
 * Dedup is deterministic rather than embedding-based. Two readings of the same
 * metric share an external id up to the date bucket, so identity is exact and
 * needs no similarity threshold to tune.
 */

const DATE_BUCKET_SUFFIX = /:\d{4}-\d{2}-\d{2}$/;

/**
 * The metric a signal measures, independent of when it was sampled.
 *
 * Falls back to source + title when there is no external id, which covers
 * manually inserted and mock signals.
 */
export function metricFamily(signal: Signal): string {
  if (signal.externalId) {
    return signal.externalId.replace(DATE_BUCKET_SUFFIX, "");
  }
  return `${signal.source ?? signal.kind}|${signal.label}`;
}

function timestampOf(signal: Signal): number {
  const parsed = Date.parse(signal.timestamp);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Keeps only the newest reading of each metric.
 *
 * Order is preserved by recency so downstream limits (`listSignals(25)`) cut
 * the oldest metrics rather than an arbitrary slice.
 */
export function dedupeByMetric(signals: Signal[]): Signal[] {
  const newest = new Map<string, Signal>();

  for (const signal of signals) {
    const family = metricFamily(signal);
    const current = newest.get(family);

    if (!current || timestampOf(signal) > timestampOf(current)) {
      newest.set(family, signal);
    }
  }

  return [...newest.values()].sort((a, b) => timestampOf(b) - timestampOf(a));
}
