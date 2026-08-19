import type { Signal } from "@/lib/types";

/**
 * Cosine similarity over embedding vectors.
 *
 * Returns 0 for absent or mismatched vectors rather than throwing: a missing
 * embedding means "cannot compare", which must read as "not a duplicate".
 * Treating it as similar would silently discard evidence.
 */
export function cosineSimilarity(a?: number[] | null, b?: number[] | null): number {
  if (!a || !b || a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Two sources describing the same real-world event should count once.
 *
 * Deliberately conservative. Only signals from *different* sources are
 * compared: within a source, `dedupeByMetric` already handles repetition by
 * exact identity, and two same-source readings that merely read alike (two
 * quiet weeks of commit activity) are genuinely separate observations.
 */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.92;

export function dedupeBySimilarity(
  signals: Signal[],
  threshold = DEFAULT_SIMILARITY_THRESHOLD
): Signal[] {
  const kept: Signal[] = [];

  for (const signal of signals) {
    const duplicate = kept.find(
      (existing) =>
        (existing.source ?? existing.kind) !== (signal.source ?? signal.kind) &&
        cosineSimilarity(existing.embedding, signal.embedding) >= threshold
    );

    if (!duplicate) {
      kept.push(signal);
    }
  }

  return kept;
}
