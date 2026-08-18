import { createLaunchQueue } from "./index";
import { runtimeEnv } from "@/lib/env";

export type ScheduleDefinition = {
  /** Stable id. `upsertJobScheduler` keys on this, so re-registering is safe. */
  id: string;
  jobName: "sweep-ingestion" | "sweep-scoring";
  pattern: string;
  enabled: boolean;
  /** Why it is off, for the boot log. */
  reason?: string;
};

/** A cron expression has 5 fields, or 6 when seconds are included. */
export function isValidCronPattern(pattern: string): boolean {
  const fields = pattern.trim().split(/\s+/);
  if (fields.length !== 5 && fields.length !== 6) {
    return false;
  }
  return fields.every((field) => /^[0-9*/,\-?LW#]+$/.test(field));
}

/**
 * Pure: decides which schedules should exist, from config alone.
 *
 * Both sweeps are off unless explicitly enabled. A scheduler that switches
 * itself on would hit external APIs — and, for scoring, spend OpenAI credit —
 * the first time anyone started a worker.
 */
export function resolveSchedules(): ScheduleDefinition[] {
  const enabled = runtimeEnv.schedulerEnabled;
  const masterOff = "SCHEDULER_ENABLED is not 'true'";

  const ingestPattern = runtimeEnv.schedulerIngestCron;
  const scorePattern = runtimeEnv.schedulerScoreCron;

  const ingest: ScheduleDefinition = {
    id: "sweep-ingestion",
    jobName: "sweep-ingestion",
    pattern: ingestPattern,
    enabled: enabled && isValidCronPattern(ingestPattern),
    reason: !enabled
      ? masterOff
      : !isValidCronPattern(ingestPattern)
        ? `invalid SCHEDULER_INGEST_CRON: ${ingestPattern}`
        : undefined
  };

  const score: ScheduleDefinition = {
    id: "sweep-scoring",
    jobName: "sweep-scoring",
    pattern: scorePattern ?? "",
    enabled: enabled && !!scorePattern && isValidCronPattern(scorePattern),
    reason: !enabled
      ? masterOff
      : !scorePattern
        ? "SCHEDULER_SCORE_CRON is unset (scoring costs OpenAI credit, so it is opt-in)"
        : !isValidCronPattern(scorePattern)
          ? `invalid SCHEDULER_SCORE_CRON: ${scorePattern}`
          : undefined
  };

  return [ingest, score];
}

export type RegistrationResult = {
  registered: { id: string; pattern: string }[];
  removed: string[];
  skipped: { id: string; reason: string }[];
};

/**
 * Reconciles the configured schedules against what is registered in Redis.
 *
 * Disabled schedules are actively removed, not merely skipped — otherwise
 * turning the scheduler off would leave the previous cron running forever.
 */
export async function registerSchedules(): Promise<RegistrationResult> {
  const result: RegistrationResult = { registered: [], removed: [], skipped: [] };
  const queue = createLaunchQueue();

  if (!queue) {
    result.skipped.push({ id: "*", reason: "REDIS_URL is not configured" });
    return result;
  }

  try {
    for (const schedule of resolveSchedules()) {
      if (schedule.enabled) {
        await queue.upsertJobScheduler(
          schedule.id,
          { pattern: schedule.pattern, tz: runtimeEnv.schedulerTimezone },
          { name: schedule.jobName, data: {} }
        );
        result.registered.push({ id: schedule.id, pattern: schedule.pattern });
      } else {
        const existing = await queue.getJobSchedulers();
        if (existing.some((s) => s.key === schedule.id)) {
          await queue.removeJobScheduler(schedule.id);
          result.removed.push(schedule.id);
        }
        result.skipped.push({ id: schedule.id, reason: schedule.reason ?? "disabled" });
      }
    }
  } finally {
    await queue.close();
  }

  return result;
}
