import { scoreLaunch } from "@/server/ai/scoring";
import { findLaunchByRepo, listLaunches, upsertLaunchScore } from "@/server/db/launches";
import { insertScoredSignals, listSignals } from "@/server/db/signals";
import { launches as fallbackLaunches, signals as fallbackSignals } from "@/lib/mock-data";
import { scoreLaunchInputSchema } from "@/lib/schema";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const body = scoreLaunchInputSchema.safeParse(json);

  if (!body.success) {
    return Response.json({ ok: false, error: body.error.flatten() }, { status: 400 });
  }

  try {
    // Score the launch the caller actually named, not just the first record.
    const launch =
      (await findLaunchByRepo(body.data.owner, body.data.repo)) ??
      (await listLaunches(1))?.[0] ??
      fallbackLaunches[0];

    const storedSignals = await listSignals(25);
    const signals =
      storedSignals && storedSignals.length > 0 ? storedSignals : fallbackSignals;

    const result = await scoreLaunch({ launch, signals });

    const persisted = await upsertLaunchScore({
      name: launch.name,
      symbol: launch.symbol,
      status: result.status,
      score: Math.round(result.score),
      rationale: result.rationale
    });

    await insertScoredSignals(persisted?.id ?? null, result.signals);

    return Response.json({
      ok: true,
      input: body.data,
      launchId: persisted?.id ?? launch.id,
      persisted: persisted !== null,
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
