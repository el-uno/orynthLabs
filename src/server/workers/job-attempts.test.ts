import { describe, expect, it } from "vitest";
import type { Job } from "bullmq";
import { currentAttempt, isFinalAttempt } from "./job-attempts";

function job(attemptsMade: number, attempts?: number) {
  return { attemptsMade, opts: { attempts } } as Job;
}

describe("job attempt accounting", () => {
  it("treats the first run as attempt 1", () => {
    expect(currentAttempt(job(0, 3))).toBe(1);
  });

  it("does not call an early attempt final when retries remain", () => {
    expect(isFinalAttempt(job(0, 3))).toBe(false);
    expect(isFinalAttempt(job(1, 3))).toBe(false);
  });

  it("calls the last configured attempt final", () => {
    expect(isFinalAttempt(job(2, 3))).toBe(true);
  });

  it("treats a job with no configured attempts as single-shot", () => {
    expect(isFinalAttempt(job(0))).toBe(true);
  });
});
