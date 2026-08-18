import { z } from "zod";
import { createLaunchQueue } from "@/server/queue";
import { attachQueueJobId, recordJobQueued } from "@/server/db/jobs";
import { authorizeApiRequest } from "@/server/auth/bearer";

const ingestChainInputSchema = z.object({
  // Base58, 32-byte encoded — length range covers the practical mint space.
  mint: z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "mint must be base58"),
  windowDays: z.number().int().min(1).max(90).optional()
});

/** Queues Solana chain ingestion. Poll GET /api/jobs/{jobRecordId}. */
export async function POST(request: Request) {
  const auth = authorizeApiRequest(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const body = ingestChainInputSchema.safeParse(json);
  if (!body.success) {
    return Response.json({ ok: false, error: body.error.flatten() }, { status: 400 });
  }

  const queue = createLaunchQueue();
  if (!queue) {
    return Response.json(
      { ok: false, error: "REDIS_URL is not configured; start Redis and run `npm run worker`" },
      { status: 503 }
    );
  }

  try {
    const jobRecordId = await recordJobQueued({
      queueName: "launch-ops",
      jobType: "ingest-chain",
      payload: { ...body.data }
    });

    const job = await queue.add("ingest-chain", { ...body.data, jobRecordId });
    await attachQueueJobId(jobRecordId, job.id);

    return Response.json({ ok: true, jobId: job.id, jobRecordId }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue ingestion job";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
