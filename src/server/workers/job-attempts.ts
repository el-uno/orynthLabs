import type { Job } from "bullmq";

/**
 * The attempt currently executing, 1-based.
 *
 * `attemptsMade` counts attempts that already finished, so the run in progress
 * is the next one.
 */
export function currentAttempt(job: Job): number {
  return job.attemptsMade + 1;
}

/** True when BullMQ will not schedule another attempt after this one fails. */
export function isFinalAttempt(job: Job): boolean {
  const maxAttempts = job.opts.attempts ?? 1;
  return currentAttempt(job) >= maxAttempts;
}
