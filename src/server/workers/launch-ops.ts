import { createWorker } from "@/server/queue";
import { scoreLaunch } from "@/server/ai/scoring";
import { markJobStatus } from "@/server/db/jobs";
import { findLaunchById, findLaunchByRepo, listLaunches, upsertLaunchScore } from "@/server/db/launches";
import { insertObservedSignals, listSignals } from "@/server/db/signals";
import { insertLaunchSnapshot } from "@/server/db/snapshots";
import { ingestGitHubActivity } from "@/server/ingestion/run-github";
import { buildLaunchSnapshot } from "@/server/workflows/launch-workflow";
import { launches as fallbackLaunches, signals as fallbackSignals } from "@/lib/mock-data";
import { currentAttempt, isFinalAttempt } from "./job-attempts";
import type { Launch } from "@/lib/types";

export type LaunchJobData = {
  launchId?: string;
  owner?: string;
  repo?: string;
  partnerPath?: string;
  windowDays?: number;
  jobRecordId?: string | null;
};

export type LaunchJobResult = {
  ok: boolean;
  launchId?: string;
  snapshotId?: string | null;
  score?: number;
  status?: string;
  signalsIngested?: number;
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
    const jobRecordId = job.data.jobRecordId;
    const attempt = currentAttempt(job);

    await markJobStatus(jobRecordId, "running", { attempts: attempt });

    try {
      if (job.name === "score-launch") {
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

        // Scoring output goes to the snapshot that produced it. It is NOT
        // written into signal_events — that fed scoring its own output and made
        // the table double on every run. See migration 0005.
        const snapshotId = await insertLaunchSnapshot({
          projectId: persisted?.id ?? null,
          source: `scoring:${launch.symbol}`,
          payload: { scoring: result },
          score: result.score,
          status: result.status
        });

        await markJobStatus(jobRecordId, "succeeded", { attempts: attempt });

        return {
          ok: true,
          launchId: persisted?.id ?? launch.id,
          snapshotId,
          score: result.score,
          status: result.status
        };
      }

      if (job.name === "ingest-github") {
        const { owner, repo, windowDays } = job.data;

        if (!owner || !repo) {
          const reason = "ingest-github requires owner and repo";
          await markJobStatus(jobRecordId, "failed", { error: reason, attempts: attempt });
          return { ok: false, reason };
        }

        const launch = await findLaunchByRepo(owner, repo);
        const signals = await ingestGitHubActivity({ owner, repo, windowDays });
        const count = await insertObservedSignals(launch?.id ?? null, signals);

        await markJobStatus(jobRecordId, "succeeded", { attempts: attempt });

        return { ok: true, launchId: launch?.id, signalsIngested: count };
      }

      if (job.name === "build-snapshot") {
        const { owner, repo, partnerPath } = job.data;

        if (!owner || !repo || !partnerPath) {
          const reason = "build-snapshot requires owner, repo, and partnerPath";
          await markJobStatus(jobRecordId, "failed", { error: reason, attempts: attempt });
          return { ok: false, reason };
        }

        const snapshot = await buildLaunchSnapshot({ owner, repo, partnerPath });

        await markJobStatus(jobRecordId, "succeeded", { attempts: attempt });

        return {
          ok: true,
          launchId: snapshot.launchId,
          snapshotId: snapshot.snapshotId,
          score: snapshot.score,
          status: snapshot.status
        };
      }

      const reason = `unsupported job name: ${job.name}`;
      await markJobStatus(jobRecordId, "failed", { error: reason, attempts: attempt });
      return { ok: false, reason };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown launch-ops error";

      await markJobStatus(jobRecordId, isFinalAttempt(job) ? "failed" : "retrying", {
        error: message,
        attempts: attempt
      });

      throw error;
    }
  });
}
