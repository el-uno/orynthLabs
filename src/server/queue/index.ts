import { Queue, Worker } from "bullmq";
import { redisConnection } from "./connection";

export const queueName = {
  launchOps: "launch-ops",
  signingOps: "signing-ops"
} as const;

export function createLaunchQueue() {
  if (!redisConnection) {
    return null;
  }

  return new Queue(queueName.launchOps, {
    connection: redisConnection
  });
}

export function createSigningQueue() {
  if (!redisConnection) {
    return null;
  }

  return new Queue(queueName.signingOps, {
    connection: redisConnection
  });
}

export function createWorker(
  queue: keyof typeof queueName,
  handler: Parameters<typeof Worker>[1]
) {
  if (!redisConnection) {
    return null;
  }

  return new Worker(queueName[queue], handler, {
    connection: redisConnection
  });
}
