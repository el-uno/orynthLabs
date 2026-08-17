import { buildLaunchSnapshot } from "@/server/workflows/launch-workflow";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    owner?: string;
    repo?: string;
    partnerPath?: string;
  };

  if (!body.owner || !body.repo || !body.partnerPath) {
    return Response.json(
      { ok: false, error: "owner, repo, and partnerPath are required" },
      { status: 400 }
    );
  }

  try {
    const snapshot = await buildLaunchSnapshot({
      owner: body.owner,
      repo: body.repo,
      partnerPath: body.partnerPath
    });

    return Response.json({ ok: true, snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
