import { Queue, Worker, type JobsOptions, type Processor } from "bullmq";
import { redisConnection } from "./connection";

export const queueName = {
  launchOps: "launch-ops",
  signingOps: "signing-ops"
} as const;

export type QueueKey = keyof typeof queueName;

/**
 * Scoring and ingestion are idempotent (upsert on symbol), so retrying a
 * transient OpenAI 429 or database blip is safe and desirable.
 */
export const launchJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
  // Keep failures around: the `jobs` table is the durable record, but the
  // BullMQ failed set is what you need to actually retry one by hand.
  removeOnFail: { age: 60 * 60 * 24 * 7 }
};

/**
 * Signing gets a single retry only. Signing itself is deterministic and does
 * not touch the chain today, so a retry is safe. REVISIT THIS the moment the
 * worker starts submitting transactions: at that point a retry risks a double
 * submission and this must become `attempts: 1` plus an idempotency key.
 */
export const signingJobOptions: JobsOptions = {
  attempts: 2,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
  removeOnFail: { age: 60 * 60 * 24 * 7 }
};

export function createLaunchQueue() {
  if (!redisConnection) {
    return null;
  }

  return new Queue(queueName.launchOps, {
    connection: redisConnection,
    defaultJobOptions: launchJobOptions
  });
}

export function createSigningQueue() {
  if (!redisConnection) {
    return null;
  }

  return new Queue(queueName.signingOps, {
    connection: redisConnection,
    defaultJobOptions: signingJobOptions
  });
}

export function createWorker<DataType = unknown, ResultType = unknown>(
  queue: QueueKey,
  handler: Processor<DataType, ResultType>
) {
  if (!redisConnection) {
    return null;
  }

  return new Worker<DataType, ResultType>(queueName[queue], handler, {
    connection: redisConnection
  });
}
