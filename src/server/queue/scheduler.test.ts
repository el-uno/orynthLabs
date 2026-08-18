import { afterEach, describe, expect, it } from "vitest";
import { isValidCronPattern, resolveSchedules } from "./scheduler";

afterEach(() => {
  delete process.env.SCHEDULER_ENABLED;
  delete process.env.SCHEDULER_INGEST_CRON;
  delete process.env.SCHEDULER_SCORE_CRON;
});

function byId(id: string) {
  return resolveSchedules().find((s) => s.id === id)!;
}

describe("isValidCronPattern", () => {
  it("accepts 5- and 6-field expressions", () => {
    expect(isValidCronPattern("0 */6 * * *")).toBe(true);
    expect(isValidCronPattern("*/30 * * * * *")).toBe(true);
  });

  it("rejects the wrong number of fields", () => {
    expect(isValidCronPattern("* * *")).toBe(false);
    expect(isValidCronPattern("")).toBe(false);
  });

  it("rejects non-cron junk", () => {
    expect(isValidCronPattern("every 6 hours")).toBe(false);
  });
});

describe("resolveSchedules", () => {
  it("disables everything by default", () => {
    const schedules = resolveSchedules();
    expect(schedules.every((s) => !s.enabled)).toBe(true);
    expect(schedules.every((s) => s.reason?.includes("SCHEDULER_ENABLED"))).toBe(true);
  });

  it("does not enable on any value other than 'true'", () => {
    for (const value of ["1", "yes", "TRUE", "on"]) {
      process.env.SCHEDULER_ENABLED = value;
      expect(byId("sweep-ingestion").enabled).toBe(false);
    }
  });

  it("enables ingestion with a default cron once switched on", () => {
    process.env.SCHEDULER_ENABLED = "true";
    const ingest = byId("sweep-ingestion");
    expect(ingest.enabled).toBe(true);
    expect(ingest.pattern).toBe("0 */6 * * *");
  });

  it("keeps scoring off even when the master switch is on", () => {
    process.env.SCHEDULER_ENABLED = "true";
    const score = byId("sweep-scoring");
    expect(score.enabled).toBe(false);
    expect(score.reason).toContain("opt-in");
  });

  it("enables scoring only when an explicit cron is supplied", () => {
    process.env.SCHEDULER_ENABLED = "true";
    process.env.SCHEDULER_SCORE_CRON = "0 3 * * *";
    expect(byId("sweep-scoring").enabled).toBe(true);
  });

  it("refuses an invalid cron rather than silently falling back", () => {
    process.env.SCHEDULER_ENABLED = "true";
    process.env.SCHEDULER_INGEST_CRON = "every 6 hours";
    const ingest = byId("sweep-ingestion");
    expect(ingest.enabled).toBe(false);
    expect(ingest.reason).toContain("invalid SCHEDULER_INGEST_CRON");
  });

  it("honours a custom ingestion cron", () => {
    process.env.SCHEDULER_ENABLED = "true";
    process.env.SCHEDULER_INGEST_CRON = "15 2 * * *";
    expect(byId("sweep-ingestion").pattern).toBe("15 2 * * *");
  });
});
