import { supabaseAdmin } from "./client";

export type JobStatus = "queued" | "running" | "retrying" | "succeeded" | "failed";

export type JobRecord = {
  id: string;
  queueName: string;
  jobType: string;
  status: JobStatus;
  attempts: number;
  payload: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

type JobRow = {
  id: string;
  queue_name: string;
  job_type: string;
  status: string;
  attempts: number | null;
  payload: Record<string, unknown> | null;
  error: string | null;
  queue_job_id: string | null;
  created_at: string;
  updated_at: string;
};

const JOB_COLUMNS =
  "id, queue_name, job_type, status, attempts, payload, error, queue_job_id, created_at, updated_at";

function toJobRecord(row: JobRow): JobRecord {
  return {
    id: row.id,
    queueName: row.queue_name,
    jobType: row.job_type,
    status: row.status as JobStatus,
    attempts: row.attempts ?? 0,
    payload: row.payload ?? {},
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

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

/** Links the durable record to the BullMQ job so a failure can be retried by hand. */
export async function attachQueueJobId(
  id: string | null | undefined,
  queueJobId: string | undefined
): Promise<void> {
  if (!supabaseAdmin || !id || !queueJobId) {
    return;
  }

  await supabaseAdmin.from("jobs").update({ queue_job_id: queueJobId }).eq("id", id);
}

export async function markJobStatus(
  id: string | null | undefined,
  status: JobStatus,
  options: { error?: string; attempts?: number } = {}
): Promise<void> {
  if (!supabaseAdmin || !id) {
    return;
  }

  const update: Record<string, unknown> = {
    status,
    error: options.error ?? null
  };

  if (typeof options.attempts === "number") {
    update.attempts = options.attempts;
  }

  const { error } = await supabaseAdmin.from("jobs").update(update).eq("id", id);

  if (error) {
    throw new Error(`Failed to update job ${id}: ${error.message}`);
  }
}

export async function findJobById(id: string): Promise<JobRecord | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load job ${id}: ${error.message}`);
  }

  return data ? toJobRecord(data as JobRow) : null;
}
