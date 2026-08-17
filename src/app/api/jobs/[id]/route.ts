import { findJobById } from "@/server/db/jobs";
import { authorizeApiRequest } from "@/server/auth/bearer";

/** Polling endpoint for the async routes. Returns the durable job record. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = authorizeApiRequest(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  try {
    const job = await findJobById(id);

    if (!job) {
      return Response.json(
        {
          ok: false,
          error: "Job not found, or Supabase is not configured"
        },
        { status: 404 }
      );
    }

    return Response.json({ ok: true, job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load job";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
