import { supabaseAdmin } from "./client";
import type { LaunchStatus } from "@/lib/types";

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
