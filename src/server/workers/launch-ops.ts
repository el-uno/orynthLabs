import { createWorker } from "@/server/queue";
import { scoreLaunch } from "@/server/ai/scoring";
import { launches, signals } from "@/lib/mock-data";
import { supabaseAdmin } from "@/server/db/client";

export function startLaunchOpsWorker() {
  return createWorker("launchOps", async (job) => {
    if (job.name === "score-launch") {
      const launchId = String(job.data.launchId ?? "");
      const launch = launches.find((item) => item.id === launchId) ?? launches[0];
      const result = await scoreLaunch({ launch, signals });

      if (supabaseAdmin) {
        await supabaseAdmin.from("launch_projects").upsert({
          name: launch.name,
          symbol: launch.symbol,
          status: result.status,
          score: result.score,
          chain: launch.chain,
          metadata: {
            rationale: result.rationale
          }
        });
      }

      return result;
    }

    return { skipped: true };
  });
}
