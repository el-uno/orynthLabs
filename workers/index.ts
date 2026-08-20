/**
 * Standalone worker process entry point.
 *
 * Run with: npm run worker
 *
 * This process is deliberately separate from the Next.js app so that ingestion
 * and scoring never run inside a request.
 */
import { runtimeEnv } from "@/lib/env";
import { registerSchedules } from "@/server/queue/scheduler";
import { startLaunchOpsWorker } from "@/server/workers/launch-ops";

async function main() {
  if (!runtimeEnv.redisUrl) {
    console.error("REDIS_URL is not set; workers cannot start.");
    process.exit(1);
  }

  const launchWorker = startLaunchOpsWorker();
  const workers = [launchWorker].filter((worker) => worker !== null);

  if (workers.length === 0) {
    console.error("No workers started; check the Redis connection.");
    process.exit(1);
  }

  for (const worker of workers) {
    worker.on("completed", (job) => {
      console.log(`[${worker.name}] completed job ${job.id} (${job.name})`);
    });

    worker.on("failed", (job, error) => {
      console.error(`[${worker.name}] failed job ${job?.id} (${job?.name}):`, error.message);
    });

    worker.on("error", (error) => {
      console.error(`[${worker.name}] worker error:`, error.message);
    });
  }

  console.log(`Started ${workers.length} worker(s): ${workers.map((w) => w.name).join(", ")}`);

  // Reconcile cron schedules on every boot. upsertJobScheduler keys on the
  // schedule id, so running several worker processes is safe; disabled
  // schedules are removed rather than left running from a previous config.
  const schedules = await registerSchedules();
  for (const entry of schedules.registered) {
    console.log(`[scheduler] active: ${entry.id} (${entry.pattern} ${runtimeEnv.schedulerTimezone})`);
  }
  for (const id of schedules.removed) {
    console.log(`[scheduler] removed stale schedule: ${id}`);
  }
  for (const entry of schedules.skipped) {
    console.log(`[scheduler] inactive: ${entry.id} — ${entry.reason}`);
  }

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}; closing workers...`);
    await Promise.all(workers.map((worker) => worker.close()));
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
