import { buildLaunchSnapshot } from "@/server/workflows/launch-workflow";
import { launchSnapshotInputSchema } from "@/lib/schema";

export async function POST(request: Request) {
  const body = launchSnapshotInputSchema.safeParse(await request.json());

  if (!body.success) {
    return Response.json(
      { ok: false, error: body.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const snapshot = await buildLaunchSnapshot({
      owner: body.data.owner,
      repo: body.data.repo,
      partnerPath: body.data.partnerPath
    });

    return Response.json({ ok: true, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
