import { z } from "zod";
import { createOpportunity, listOpportunities } from "@/server/db/launches";
import { authorizeApiRequest } from "@/server/auth/bearer";

const createOpportunityInputSchema = z.object({
  name: z.string().min(3).max(120),
  /** The problem space. Ingestion and assessment both key off this. */
  marketTopic: z.string().min(3).max(120)
});

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Registers a candidate market gap for the ingestion sweep to investigate. */
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

  const body = createOpportunityInputSchema.safeParse(json);
  if (!body.success) {
    return Response.json({ ok: false, error: body.error.flatten() }, { status: 400 });
  }

  try {
    const opportunity = await createOpportunity({
      slug: slugify(body.data.name),
      name: body.data.name,
      marketTopic: body.data.marketTopic
    });

    if (!opportunity) {
      return Response.json(
        { ok: false, error: "Supabase is not configured" },
        { status: 503 }
      );
    }

    return Response.json({ ok: true, opportunity }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create opportunity";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

/** The Idea Marketplace: candidate gaps, strongest first. */
export async function GET(request: Request) {
  const auth = authorizeApiRequest(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  try {
    const opportunities = await listOpportunities();
    return Response.json({ ok: true, opportunities: opportunities ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list opportunities";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
