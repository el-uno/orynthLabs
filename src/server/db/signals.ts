import { supabaseAdmin } from "./client";
import { embedTexts, embeddingText } from "@/server/ai/embeddings";
import { severitySchema, signalKindSchema } from "@/lib/schema";
import { familyForKind } from "@/lib/types";
import type {
  ObservedSignal,
  Signal,
  SignalFamily,
  SignalKind,
  SignalSeverity
} from "@/lib/types";

type SignalRow = {
  id: string;
  project_id: string | null;
  source: string;
  external_id: string | null;
  kind: string;
  family: string | null;
  severity: string;
  title: string;
  detail: string;
  value: string | null;
  score_delta: number;
  observed_at: string | null;
  created_at: string;
};

const SIGNAL_COLUMNS =
  "id, project_id, source, external_id, kind, family, severity, title, detail, value, score_delta, observed_at, created_at";

function toKind(value: string): SignalKind {
  const parsed = signalKindSchema.safeParse(value);
  return parsed.success ? parsed.data : "partner";
}

function toSeverity(value: string): SignalSeverity {
  const parsed = severitySchema.safeParse(value);
  return parsed.success ? parsed.data : "low";
}

function toSignal(row: SignalRow): Signal {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    kind: toKind(row.kind),
    // Legacy rows predate the column; derive rather than leaving a hole.
    family: (row.family as SignalFamily | null) ?? familyForKind(toKind(row.kind)),
    label: row.title,
    severity: toSeverity(row.severity),
    value: row.value ?? "",
    detail: row.detail,
    scoreDelta: row.score_delta,
    // Prefer when the event happened upstream over when we stored it.
    timestamp: row.observed_at ?? row.created_at
  };
}

export async function listSignals(limit = 25): Promise<Signal[] | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("signal_events")
    .select(SIGNAL_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list signals: ${error.message}`);
  }

  return (data as SignalRow[]).map(toSignal);
}

/**
 * Persists observed signals, keyed on (source, external_id) so re-running
 * ingestion updates rather than appends.
 *
 * This is the only write path into `signal_events`. Scoring output must never
 * be written here — it is an artifact of a scoring run and belongs on
 * `launch_snapshots.payload`. Writing it back created a feedback loop where
 * each run consumed the previous run's output and the table doubled.
 */
export async function insertObservedSignals(
  projectId: string | null,
  signals: ObservedSignal[]
): Promise<number> {
  if (!supabaseAdmin || signals.length === 0) {
    return 0;
  }

  // Best-effort embeddings. A failure here must never cost a signal, so the
  // ingestion continues with nulls and dedup falls back to exact identity.
  let embeddings: number[][] | null = null;
  try {
    embeddings = await embedTexts(
      signals.map((s) => embeddingText({ title: s.title, detail: s.detail }))
    );
  } catch {
    embeddings = null;
  }

  const rows = signals.map((signal, index) => ({
    project_id: projectId,
    source: signal.source,
    external_id: signal.externalId,
    kind: signal.kind,
    family: signal.family,
    severity: signal.severity,
    title: signal.title,
    detail: signal.detail,
    value: signal.value,
    score_delta: signal.scoreDelta,
    observed_at: signal.observedAt,
    embedding: embeddings?.[index] ?? null,
    raw: signal.raw ?? {}
  }));

  const { error } = await supabaseAdmin
    .from("signal_events")
    .upsert(rows, { onConflict: "source,external_id" });

  if (error) {
    throw new Error(`Failed to upsert observed signals: ${error.message}`);
  }

  return rows.length;
}

/**
 * Signals for scoring, including embeddings.
 *
 * Separate from `listSignals` because 1536 floats per row is an unacceptable
 * payload for a page render but fine for a background scoring job.
 */
export async function listSignalsForScoring(
  projectId: string | null,
  limit = 50
): Promise<Signal[] | null> {
  if (!supabaseAdmin) {
    return null;
  }

  // Scoped to the entity. Reading the table globally meant every entity was
  // assessed on everyone else's evidence: three companies with different
  // repositories scored identically, and an opportunity with only
  // market-structure signals borrowed another entity's demand to claim an
  // intersection that had not been observed for it.
  let query = supabaseAdmin
    .from("signal_events")
    .select(`${SIGNAL_COLUMNS}, embedding`)
    .order("created_at", { ascending: false })
    .limit(limit);

  query = projectId === null ? query.is("project_id", null) : query.eq("project_id", projectId);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list signals for scoring: ${error.message}`);
  }

  return (data as (SignalRow & { embedding: number[] | string | null })[]).map((row) => ({
    ...toSignal(row),
    // pgvector comes back as a string over PostgREST; parse it back to numbers.
    embedding:
      typeof row.embedding === "string"
        ? (JSON.parse(row.embedding) as number[])
        : (row.embedding ?? null)
  }));
}
