import { supabaseAdmin } from "./client";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

/**
 * Records a queue job so operators can trace work without attaching to Redis.
 * Payloads should be summaries, not raw transaction blobs.
 */
export async function recordJobQueued(input: {
  queueName: string;
  jobType: string;
  payload: Record<string, unknown>;
}): Promise<string | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .insert({
      queue_name: input.queueName,
      job_type: input.jobType,
      status: "queued" satisfies JobStatus,
      payload: input.payload
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to record job: ${error.message}`);
  }

  return (data as { id: string }).id;
}

export async function markJobStatus(
  id: string | null | undefined,
  status: JobStatus,
  errorMessage?: string
): Promise<void> {
  if (!supabaseAdmin || !id) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("jobs")
    .update({ status, error: errorMessage ?? null })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update job ${id}: ${error.message}`);
  }
}
