import { z } from "zod";
import { createSigningQueue } from "@/server/queue";
import { attachQueueJobId, recordJobQueued } from "@/server/db/jobs";
import { authorizeSigningRequest } from "@/server/signing/auth";
import { evaluateSigningPolicy } from "@/server/signing/policy";

const enqueueSigningInputSchema = z.object({
  serializedTransaction: z.string().min(1)
});

export async function POST(request: Request) {
  const auth = authorizeSigningRequest(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const body = enqueueSigningInputSchema.safeParse(json);
  if (!body.success) {
    return Response.json({ ok: false, error: body.error.flatten() }, { status: 400 });
  }

  // Reject unacceptable transactions at the edge so nothing reaches the queue.
  // The worker re-runs this same policy before any key touches the payload.
  let policy: ReturnType<typeof evaluateSigningPolicy>;
  try {
    policy = evaluateSigningPolicy(body.data.serializedTransaction);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signing policy error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }

  if (!policy.ok) {
    return Response.json({ ok: false, error: policy.reason }, { status: 422 });
  }

  const queue = createSigningQueue();
  if (!queue) {
    return Response.json(
      { ok: false, error: "Redis is not configured; signing queue unavailable" },
      { status: 503 }
    );
  }

  try {
    // Persist a summary, never the transaction blob itself.
    const jobRecordId = await recordJobQueued({
      queueName: "signing-ops",
      jobType: "sign-transaction",
      payload: {
        programIds: policy.programIds,
        requiredSigners: policy.requiredSigners,
        instructionCount: policy.transaction.instructions.length
      }
    });

    const job = await queue.add("sign-transaction", {
      serializedTransaction: body.data.serializedTransaction,
      jobRecordId
    });

    await attachQueueJobId(jobRecordId, job.id);

    return Response.json({ ok: true, jobId: job.id, jobRecordId }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue signing job";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
