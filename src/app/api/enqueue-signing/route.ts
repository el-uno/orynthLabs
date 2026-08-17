import { createSigningQueue } from "@/server/queue";
import { runtimeEnv } from "@/lib/env";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    serializedTransaction?: string;
  };

  if (!body.serializedTransaction) {
    return Response.json(
      { ok: false, error: "serializedTransaction is required" },
      { status: 400 }
    );
  }

  if (!runtimeEnv.redisUrl) {
    return Response.json(
      {
        ok: false,
        error: "Redis is not configured"
      },
      { status: 503 }
    );
  }

  const queue = createSigningQueue();
  if (!queue) {
    return Response.json({ ok: false, error: "Queue unavailable" }, { status: 503 });
  }

  const job = await queue.add("sign-transaction", {
    serializedTransaction: body.serializedTransaction
  });

  return Response.json({ ok: true, jobId: job.id });
}
