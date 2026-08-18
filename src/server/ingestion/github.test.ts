import { describe, expect, it } from "vitest";
import { normalizeGitHubActivity } from "./github";
import type { GitHubCommit, GitHubPullRequest, GitHubRepository } from "@/server/clients/github";

const NOW = new Date("2026-08-18T12:00:00Z");

function repo(overrides: Partial<GitHubRepository> = {}): GitHubRepository {
  return {
    full_name: "atlas-protocol/atlas",
    description: "test",
    stargazers_count: 120,
    forks_count: 14,
    open_issues_count: 3,
    pushed_at: "2026-08-18T09:00:00Z",
    created_at: "2025-01-01T00:00:00Z",
    archived: false,
    language: "Rust",
    ...overrides
  };
}

function commit(daysAgo: number, sha: string, author = "alice"): GitHubCommit {
  const date = new Date(NOW.getTime() - daysAgo * 86400000).toISOString();
  return { sha, commit: { message: "msg", author: { name: author, date } }, author: { login: author } };
}

function pr(mergedDaysAgo: number | null, number: number, state = "closed"): GitHubPullRequest {
  return {
    number,
    title: `pr ${number}`,
    state,
    created_at: NOW.toISOString(),
    merged_at: mergedDaysAgo === null ? null : new Date(NOW.getTime() - mergedDaysAgo * 86400000).toISOString(),
    closed_at: null,
    user: { login: "alice" }
  };
}

function run(input: { commits?: GitHubCommit[]; pullRequests?: GitHubPullRequest[]; repository?: GitHubRepository }) {
  return normalizeGitHubActivity({
    owner: "atlas-protocol",
    repo: "atlas",
    repository: input.repository ?? repo(),
    commits: input.commits ?? [],
    pullRequests: input.pullRequests ?? [],
    now: NOW
  });
}

describe("normalizeGitHubActivity", () => {
  it("produces one signal per activity dimension", () => {
    const signals = run({});
    expect(signals).toHaveLength(3);
    expect(signals.map((s) => s.title)).toEqual([
      "GitHub commit activity",
      "GitHub pull request throughput",
      "GitHub repository profile"
    ]);
  });

  it("excludes commits older than the window", () => {
    const signals = run({ commits: [commit(1, "a"), commit(3, "b"), commit(30, "old")] });
    const commits = signals[0];
    expect(commits.value).toBe("2 commits");
    expect(commits.detail).toContain("2 commits");
  });

  it("escalates severity with commit volume", () => {
    expect(run({ commits: [commit(1, "a")] })[0].severity).toBe("low");
    expect(run({ commits: Array.from({ length: 4 }, (_, i) => commit(1, `c${i}`)) })[0].severity).toBe("medium");
    expect(run({ commits: Array.from({ length: 12 }, (_, i) => commit(1, `c${i}`)) })[0].severity).toBe("high");
  });

  it("counts distinct commit authors", () => {
    const signals = run({ commits: [commit(1, "a", "alice"), commit(1, "b", "bob"), commit(1, "c", "alice")] });
    expect(signals[0].detail).toContain("2 author(s)");
  });

  it("counts only merged pull requests inside the window", () => {
    const signals = run({ pullRequests: [pr(1, 1), pr(2, 2), pr(40, 3), pr(null, 4, "open")] });
    expect(signals[1].value).toBe("2 merged");
    expect(signals[1].detail).toContain("1 currently open");
  });

  it("treats an archived repository as a high-severity negative signal", () => {
    const signals = run({ repository: repo({ archived: true }) });
    const profile = signals[2];
    expect(profile.severity).toBe("high");
    expect(profile.title).toBe("GitHub repository archived");
    expect(profile.scoreDelta).toBeLessThan(0);
  });

  it("gives every signal a stable external id scoped to source, repo and day", () => {
    const signals = run({ commits: [commit(1, "a")] });
    expect(signals.map((s) => s.externalId)).toEqual([
      "atlas-protocol/atlas:commits:2026-08-18",
      "atlas-protocol/atlas:pull-requests:2026-08-18",
      "atlas-protocol/atlas:repository:2026-08-18"
    ]);
    expect(signals.every((s) => s.source === "github")).toBe(true);
  });

  it("is idempotent within a day: re-running yields identical dedup keys", () => {
    const first = run({ commits: [commit(1, "a")] });
    const second = normalizeGitHubActivity({
      owner: "atlas-protocol",
      repo: "atlas",
      repository: repo(),
      commits: [commit(1, "a"), commit(2, "b")],
      pullRequests: [],
      // Same day, later in the day.
      now: new Date("2026-08-18T23:30:00Z")
    });

    expect(second.map((s) => s.externalId)).toEqual(first.map((s) => s.externalId));
    // Same keys, updated reading — an upsert, not a duplicate.
    expect(second[0].value).toBe("2 commits");
  });

  it("produces new dedup keys on a different day, preserving history", () => {
    const today = run({});
    const tomorrow = normalizeGitHubActivity({
      owner: "atlas-protocol",
      repo: "atlas",
      repository: repo(),
      commits: [],
      pullRequests: [],
      now: new Date("2026-08-19T12:00:00Z")
    });

    expect(tomorrow[0].externalId).not.toBe(today[0].externalId);
    expect(tomorrow[0].externalId).toContain("2026-08-19");
  });
});
