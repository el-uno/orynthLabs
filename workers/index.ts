/**
 * Standalone worker process entry point.
 *
 * Run with: npm run worker
 *
 * This process is deliberately separate from the Next.js app. It is the only
 * runtime that needs the signing keys, so it can be deployed to a host with a
 * tighter secret scope than the web tier.
 */
import { runtimeEnv } from "@/lib/env";
import { startLaunchOpsWorker } from "@/server/workers/launch-ops";
import { startSigningWorker } from "@/server/workers/signing-ops";

async function main() {
  if (!runtimeEnv.redisUrl) {
    console.error("REDIS_URL is not set; workers cannot start.");
    process.exit(1);
  }

  const launchWorker = startLaunchOpsWorker();
  const signingWorker = startSigningWorker();
  const workers = [launchWorker, signingWorker].filter((worker) => worker !== null);

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

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}; closing workers...`);
    await Promise.all(workers.map((worker) => worker.close()));
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
