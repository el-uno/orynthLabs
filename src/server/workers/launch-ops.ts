import { createLaunchQueue, createWorker } from "@/server/queue";
import { scoreLaunch } from "@/server/ai/scoring";
import { markJobStatus, recordJobQueued } from "@/server/db/jobs";
import {
  findLaunchById,
  findLaunchByMarketTopic,
  findLaunchByMint,
  findLaunchByRepo,
  listLaunches,
  listLaunchesWithGitHubRepo,
  listLaunchesWithMarketTopic,
  listLaunchesWithTokenMint,
  upsertLaunchScore
} from "@/server/db/launches";
import { insertObservedSignals, listSignalsForScoring } from "@/server/db/signals";
import { insertLaunchSnapshot } from "@/server/db/snapshots";
import { GitHubRateLimitError } from "@/server/clients/github";
import { SolanaRpcError } from "@/server/clients/helius";
import { NpmError } from "@/server/clients/npm";
import { ingestChainActivity } from "@/server/ingestion/run-helius";
import { ingestMarketStructure } from "@/server/ingestion/run-market-structure";
import { ingestConsumerActivity } from "@/server/ingestion/run-consumer";
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
  mint?: string;
  topic?: string;
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
  fannedOut?: number;
  reason?: string;
};

/**
 * Fans a sweep out into one job per tracked launch.
 *
 * Routed through createLaunchQueue() deliberately: a bare `new Queue()` would
 * silently drop the retry policy that lives in the factory's defaultJobOptions.
 *
 * No deterministic jobId is used for de-duplication. Ingestion upserts on
 * (source, external_id), so an overlapping run rewrites the same rows rather
 * than appending — the idempotency work makes queue-level dedup unnecessary.
 *
 * Each child gets its own `jobs` row. Scheduled work never passes through an
 * API route, so without this the scheduler would run unattended with no
 * operational trace in the database at all.
 */
async function fanOut<T extends { id: string; slug: string }>(
  jobName:
    | "ingest-github"
    | "ingest-chain"
    | "ingest-market"
    | "ingest-consumer"
    | "score-launch",
  load: () => Promise<T[] | null>,
  build: (launch: T) => Record<string, unknown>
): Promise<number> {
  const launches = await load();

  if (!launches || launches.length === 0) {
    return 0;
  }

  const queue = createLaunchQueue();
  if (!queue) {
    return 0;
  }

  try {
    const entries = await Promise.all(
      launches.map(async (launch) => {
        const data = build(launch);
        const jobRecordId = await recordJobQueued({
          queueName: "launch-ops",
          jobType: jobName,
          payload: { ...data, scheduled: true, slug: launch.slug }
        });
        return { name: jobName, data: { ...data, jobRecordId } };
      })
    );

    await queue.addBulk(entries);
    return entries.length;
  } finally {
    await queue.close();
  }
}

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
    // Jobs enqueued outside an API route (cron sweeps, fan-out children that
    // lost their id) still need a durable record, otherwise scheduled work is
    // invisible in the jobs table.
    const jobRecordId =
      job.data.jobRecordId ??
      (await recordJobQueued({
        queueName: "launch-ops",
        jobType: job.name,
        payload: { scheduled: true }
      }));
    const attempt = currentAttempt(job);

    await markJobStatus(jobRecordId, "running", { attempts: attempt });

    try {
      if (job.name === "score-launch") {
        const launch = await resolveLaunch(job.data.launchId);
        const storedSignals = await listSignalsForScoring(50);
        const signals =
          storedSignals && storedSignals.length > 0 ? storedSignals : fallbackSignals;

        const result = await scoreLaunch({ launch, signals });

        const persisted = await upsertLaunchScore({
          slug: launch.slug,
          name: launch.name,
          symbol: launch.symbol,
          status: result.status,
          score: Math.round(result.score),
          rationale: result.rationale,
          recommendation: result.assessment.recommendation,
          readiness: result.assessment.readiness
        });

        // Scoring output goes to the snapshot that produced it. It is NOT
        // written into signal_events — that fed scoring its own output and made
        // the table double on every run. See migration 0005.
        const snapshotId = await insertLaunchSnapshot({
          projectId: persisted?.id ?? null,
          source: `scoring:${launch.slug}`,
          // Persist the threshold reasoning alongside the score: a status
          // nobody can interrogate is a status nobody should trust.
          payload: {
            scoring: result,
            statusDecision: result.statusDecision,
            assessment: result.assessment
          },
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

        let signals;
        try {
          signals = await ingestGitHubActivity({ owner, repo, windowDays });
        } catch (error) {
          // Fail fast on rate limiting. The window resets on the hour, so
          // burning three attempts seconds apart cannot succeed.
          if (error instanceof GitHubRateLimitError) {
            await markJobStatus(jobRecordId, "failed", {
              error: error.message,
              attempts: attempt
            });
            return { ok: false, reason: error.message };
          }
          throw error;
        }

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

      if (job.name === "ingest-chain") {
        const { mint, windowDays } = job.data;

        if (!mint) {
          const reason = "ingest-chain requires mint";
          await markJobStatus(jobRecordId, "failed", { error: reason, attempts: attempt });
          return { ok: false, reason };
        }

        const launch = await findLaunchByMint(mint);

        let signals;
        try {
          signals = await ingestChainActivity({ mint, windowDays });
        } catch (error) {
          // RPC rate limiting is not transient on retry timescales.
          if (error instanceof SolanaRpcError && error.rateLimited) {
            await markJobStatus(jobRecordId, "failed", {
              error: error.message,
              attempts: attempt
            });
            return { ok: false, reason: error.message };
          }
          throw error;
        }

        const count = await insertObservedSignals(launch?.id ?? null, signals);

        await markJobStatus(jobRecordId, "succeeded", { attempts: attempt });
        return { ok: true, launchId: launch?.id, signalsIngested: count };
      }

      if (job.name === "ingest-consumer") {
        const { owner, repo, windowDays } = job.data;

        if (!owner || !repo) {
          const reason = "ingest-consumer requires owner and repo";
          await markJobStatus(jobRecordId, "failed", { error: reason, attempts: attempt });
          return { ok: false, reason };
        }

        const launch = await findLaunchByRepo(owner, repo);

        let signals;
        try {
          signals = await ingestConsumerActivity({ owner, repo, windowDays });
        } catch (error) {
          if (error instanceof GitHubRateLimitError) {
            await markJobStatus(jobRecordId, "failed", {
              error: error.message,
              attempts: attempt
            });
            return { ok: false, reason: error.message };
          }
          throw error;
        }

        const count = await insertObservedSignals(launch?.id ?? null, signals);

        await markJobStatus(jobRecordId, "succeeded", { attempts: attempt });
        return { ok: true, launchId: launch?.id, signalsIngested: count };
      }

      if (job.name === "ingest-market") {
        const { topic } = job.data;

        if (!topic) {
          const reason = "ingest-market requires topic";
          await markJobStatus(jobRecordId, "failed", { error: reason, attempts: attempt });
          return { ok: false, reason };
        }

        const launch = await findLaunchByMarketTopic(topic);

        let signals;
        try {
          signals = await ingestMarketStructure({ topic });
        } catch (error) {
          // Registry rate limiting resets on a short window but not within a
          // retry burst; fail fast rather than spend the budget.
          if (error instanceof NpmError && error.rateLimited) {
            await markJobStatus(jobRecordId, "failed", {
              error: error.message,
              attempts: attempt
            });
            return { ok: false, reason: error.message };
          }
          throw error;
        }

        const count = await insertObservedSignals(launch?.id ?? null, signals);

        await markJobStatus(jobRecordId, "succeeded", { attempts: attempt });
        return { ok: true, launchId: launch?.id, signalsIngested: count };
      }

      if (job.name === "sweep-ingestion") {
        // One sweep covers every source. A launch may have a repo, a mint, or
        // both, and each is fanned out independently.
        const github = await fanOut("ingest-github", listLaunchesWithGitHubRepo, (launch) => ({
          owner: launch.owner,
          repo: launch.repo
        }));
        const chain = await fanOut("ingest-chain", listLaunchesWithTokenMint, (launch) => ({
          mint: launch.mint
        }));
        const market = await fanOut("ingest-market", listLaunchesWithMarketTopic, (launch) => ({
          topic: launch.topic
        }));
        // Same repo list as builder ingestion, different evidence: commits are
        // what the team does, issues are what users experience.
        const consumer = await fanOut("ingest-consumer", listLaunchesWithGitHubRepo, (launch) => ({
          owner: launch.owner,
          repo: launch.repo
        }));

        await markJobStatus(jobRecordId, "succeeded", { attempts: attempt });
        return { ok: true, fannedOut: github + chain + market + consumer };
      }

      if (job.name === "sweep-scoring") {
        const fannedOut = await fanOut("score-launch", listLaunchesWithGitHubRepo, (launch) => ({
          launchId: launch.id
        }));

        await markJobStatus(jobRecordId, "succeeded", { attempts: attempt });
        return { ok: true, fannedOut };
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
