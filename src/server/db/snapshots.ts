import { supabaseAdmin } from "./client";
import type { LaunchStatus, ScorePoint } from "@/lib/types";

export async function insertLaunchSnapshot(input: {
  projectId: string | null;
  source: string;
  payload: unknown;
  score: number;
  status: LaunchStatus;
}): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_snapshots")
    .insert({
      project_id: input.projectId,
      source: input.source,
      payload: input.payload,
      score: Math.round(input.score),
      status: input.status
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to insert launch snapshot: ${error.message}`);
  }

  return (data as { id: string }).id;
}

/**
 * Scoring history for several launches in one query.
 *
 * Batched deliberately: the dashboard renders every launch, and a per-launch
 * query would be an N+1 on the hottest read path in the app.
 */
export async function listScoreHistoryFor(
  projectIds: string[],
  perLaunch = 20
): Promise<Map<string, ScorePoint[]>> {
  const grouped = new Map<string, ScorePoint[]>();

  if (!supabaseAdmin || projectIds.length === 0) {
    return grouped;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_snapshots")
    .select("project_id, score, status, created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(projectIds.length * perLaunch);

  if (error) {
    throw new Error(`Failed to load score history: ${error.message}`);
  }

  const rows = data as {
    project_id: string | null;
    score: number;
    status: string;
    created_at: string;
  }[];

  for (const row of rows) {
    if (!row.project_id) {
      continue;
    }

    const points = grouped.get(row.project_id) ?? [];
    if (points.length < perLaunch) {
      points.push({
        score: row.score,
        status: row.status as LaunchStatus,
        at: row.created_at
      });
      grouped.set(row.project_id, points);
    }
  }

  return grouped;
}
