import { createWorker } from "@/server/queue";
import { scoreLaunch } from "@/server/ai/scoring";
import { markJobStatus } from "@/server/db/jobs";
import { findLaunchById, listLaunches, upsertLaunchScore } from "@/server/db/launches";
import { insertScoredSignals, listSignals } from "@/server/db/signals";
import { launches as fallbackLaunches, signals as fallbackSignals } from "@/lib/mock-data";
import type { Launch } from "@/lib/types";

export type LaunchJobData = {
  launchId?: string;
  jobRecordId?: string | null;
};

export type LaunchJobResult = {
  ok: boolean;
  launchId?: string;
  score?: number;
  status?: string;
  persistedSignals?: number;
  reason?: string;
};

async function resolveLaunch(launchId: string | undefined): Promise<Launch> {
  if (launchId) {
    const found = await findLaunchById(launchId);
    if (found) {
      return found;
    }
  }

  const stored = await listLaunches(1);
  if (stored && stored.length > 0) {
    return stored[0];
  }

  return fallbackLaunches[0];
}

export function startLaunchOpsWorker() {
  return createWorker<LaunchJobData, LaunchJobResult>("launchOps", async (job) => {
    if (job.name !== "score-launch") {
      return { ok: false, reason: `unsupported job name: ${job.name}` };
    }

    const jobRecordId = job.data.jobRecordId;
    await markJobStatus(jobRecordId, "running");

    try {
      const launch = await resolveLaunch(job.data.launchId);
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

      const persistedSignals = await insertScoredSignals(
        persisted?.id ?? null,
        result.signals
      );

      await markJobStatus(jobRecordId, "succeeded");

      return {
        ok: true,
        launchId: persisted?.id ?? launch.id,
        score: result.score,
        status: result.status,
        persistedSignals
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown scoring error";
      await markJobStatus(jobRecordId, "failed", message);
      throw error;
    }
  });
}
