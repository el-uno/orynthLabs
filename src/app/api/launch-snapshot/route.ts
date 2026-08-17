import { createLaunchQueue } from "@/server/queue";
import { attachQueueJobId, recordJobQueued } from "@/server/db/jobs";
import { authorizeApiRequest } from "@/server/auth/bearer";
import { launchSnapshotInputSchema } from "@/lib/schema";

/**
 * Enqueues snapshot composition. The workflow fans out to GitHub and the
 * partner API and then scores, which is well past a sensible request budget.
 * Poll GET /api/jobs/{id} with the returned jobRecordId for the outcome.
 */
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

  const body = launchSnapshotInputSchema.safeParse(json);
  if (!body.success) {
    return Response.json({ ok: false, error: body.error.flatten() }, { status: 400 });
  }

  const queue = createLaunchQueue();
  if (!queue) {
    return Response.json(
      {
        ok: false,
        error: "REDIS_URL is not configured; start Redis and run `npm run worker`"
      },
      { status: 503 }
    );
  }

  try {
    const jobRecordId = await recordJobQueued({
      queueName: "launch-ops",
      jobType: "build-snapshot",
      payload: { ...body.data }
    });

    const job = await queue.add("build-snapshot", {
      owner: body.data.owner,
      repo: body.data.repo,
      partnerPath: body.data.partnerPath,
      jobRecordId
    });

    await attachQueueJobId(jobRecordId, job.id);

    return Response.json({ ok: true, jobId: job.id, jobRecordId }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue snapshot job";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
