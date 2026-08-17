import { Queue, Worker, type Processor } from "bullmq";
import { redisConnection } from "./connection";

export const queueName = {
  launchOps: "launch-ops",
  signingOps: "signing-ops"
} as const;

export type QueueKey = keyof typeof queueName;

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
