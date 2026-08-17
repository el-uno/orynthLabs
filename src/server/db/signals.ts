import { z } from "zod";
import { supabaseAdmin } from "./client";
import { scoredSignalSchema, severitySchema, signalKindSchema } from "@/lib/schema";
import type { Signal, SignalKind, SignalSeverity } from "@/lib/types";

type SignalRow = {
  id: string;
  project_id: string | null;
  source: string;
  kind: string;
  severity: string;
  title: string;
  detail: string;
  value: string | null;
  score_delta: number;
  created_at: string;
};

type ScoredSignal = z.infer<typeof scoredSignalSchema>;

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
    kind: toKind(row.kind),
    label: row.title,
    severity: toSeverity(row.severity),
    value: row.value ?? "",
    detail: row.detail,
    timestamp: row.created_at
  };
}

export async function listSignals(limit = 25): Promise<Signal[] | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("signal_events")
    .select(
      "id, project_id, source, kind, severity, title, detail, value, score_delta, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list signals: ${error.message}`);
  }

  return (data as SignalRow[]).map(toSignal);
}

export async function insertScoredSignals(
  projectId: string | null,
  signals: ScoredSignal[]
): Promise<number> {
  if (!supabaseAdmin || signals.length === 0) {
    return 0;
  }

  const rows = signals.map((signal) => ({
    project_id: projectId,
    source: signal.source,
    kind: signal.kind,
    severity: signal.severity,
    title: signal.title,
    detail: signal.detail,
    value: signal.value ?? null,
    score_delta: signal.scoreDelta,
    raw: signal
  }));

  const { error } = await supabaseAdmin.from("signal_events").insert(rows);

  if (error) {
    throw new Error(`Failed to insert signals: ${error.message}`);
  }

  return rows.length;
}
