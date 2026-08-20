import { describe, expect, it } from "vitest";
import { issuesOnly, normalizeConsumerActivity } from "./consumer";
import type { GitHubIssue } from "@/server/clients/github";

const NOW = new Date("2026-08-19T12:00:00Z");

function issue(overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    number: Math.floor(Math.random() * 10000),
    title: "something",
    state: "open",
    created_at: new Date(NOW.getTime() - 86400000).toISOString(),
    closed_at: null,
    comments: 2,
    labels: [],
    user: { login: `user${Math.random()}` },
    ...overrides
  };
}

function pull(): GitHubIssue {
  return issue({ pull_request: { url: "x" } });
}

function run(issues: GitHubIssue[], totalCount?: number | null) {
  return normalizeConsumerActivity({
    owner: "acme",
    repo: "widget",
    issues,
    totalCount,
    now: NOW
  });
}

describe("issuesOnly", () => {
  // Measured against vercel/next.js, 80 of 100 returned items were PRs.
  // Counting them turns user voice into contributor activity.
  it("excludes pull requests", () => {
    expect(issuesOnly([issue(), pull(), issue(), pull()])).toHaveLength(2);
  });
});

describe("normalizeConsumerActivity", () => {
  it("tags every signal to the consumer family", () => {
    const signals = run(Array.from({ length: 10 }, () => issue()));
    expect(signals.every((s) => s.family === "consumer")).toBe(true);
  });

  it("reports how many pull requests it discarded", () => {
    const raw = run([issue(), pull(), pull()])[0].raw as { pullRequestsExcluded: number };
    expect(raw.pullRequestsExcluded).toBe(2);
  });

  it("excludes issues created outside the window", () => {
    const old = issue({ created_at: new Date(NOW.getTime() - 90 * 86400000).toISOString() });
    expect(run([issue(), old])[0].value).toBe("1 issues");
  });

  // The sample is one page shared with PRs, so a busy repo reports a fraction
  // of real volume — and undercounts most for the most-used products.
  it("prefers the exact count over the sample size", () => {
    const demand = run([issue(), issue()], 289)[0];
    expect(demand.value).toBe("289 issues");
    expect(demand.severity).toBe("high");
    expect((demand.raw as { countIsExact: boolean }).countIsExact).toBe(true);
  });

  it("says so when it is only reporting a floor", () => {
    const demand = run([issue(), issue()], null)[0];
    expect(demand.detail).toContain("at least");
    expect(demand.detail).toContain("sampled");
    expect((demand.raw as { countIsExact: boolean }).countIsExact).toBe(false);
  });

  // Unlike market_structure, this family does not invert: it measures the
  // entity's own users, so being ignored is simply bad.
  it("counts ignored users against the product", () => {
    const ignored = Array.from({ length: 10 }, () => issue({ comments: 0 }));
    const responsiveness = run(ignored).find((s) => s.title === "Maintainer responsiveness")!;
    expect(responsiveness.scoreDelta).toBeLessThan(0);
    expect(responsiveness.value).toBe("100% unanswered");
  });

  it("rewards a responsive maintainer", () => {
    const answered = Array.from({ length: 10 }, () => issue({ comments: 3 }));
    const responsiveness = run(answered).find((s) => s.title === "Maintainer responsiveness")!;
    expect(responsiveness.scoreDelta).toBeGreaterThan(0);
  });

  // "100% unanswered" across two issues is a quiet week, not neglect.
  it("omits ratios below the sample floor", () => {
    const titles = run([issue({ comments: 0 }), issue({ comments: 0 })]).map((s) => s.title);
    expect(titles).toEqual(["User-reported demand"]);
  });

  it("omits composition when the repository does not label issues", () => {
    const unlabelled = Array.from({ length: 10 }, () => issue({ labels: [] }));
    expect(run(unlabelled).find((s) => s.title === "User issue composition")).toBeUndefined();
  });

  it("treats a bug-dominated backlog as a quality problem", () => {
    const buggy = Array.from({ length: 10 }, () => issue({ labels: [{ name: "bug" }] }));
    const composition = run(buggy).find((s) => s.title === "User issue composition")!;
    expect(composition.scoreDelta).toBeLessThan(0);
    expect(composition.value).toBe("100% bugs");
  });

  it("treats feature requests as engaged demand", () => {
    const wanted = Array.from({ length: 10 }, () => issue({ labels: [{ name: "enhancement" }] }));
    const composition = run(wanted).find((s) => s.title === "User issue composition")!;
    expect(composition.scoreDelta).toBeGreaterThan(0);
  });

  it("gives signals a repo- and day-scoped external id", () => {
    expect(run([issue()])[0].externalId).toBe("acme/widget:user-demand:2026-08-19");
  });
});
