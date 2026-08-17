import { scoreLaunch } from "@/server/ai/scoring";
import { launches, signals } from "@/lib/mock-data";
import { scoreLaunchInputSchema } from "@/lib/schema";

export async function POST(request: Request) {
  const body = scoreLaunchInputSchema.safeParse(await request.json());

  if (!body.success) {
    return Response.json(
      { ok: false, error: body.error.flatten() },
      { status: 400 }
    );
  }

  const launch = launches[0];
  const result = await scoreLaunch({ launch, signals });

  return Response.json({
    ok: true,
    input: body.data,
    result
  });
}
