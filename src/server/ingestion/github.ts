import type {
  GitHubCommit,
  GitHubPullRequest,
  GitHubRepository
} from "@/server/clients/github";
import type { ObservedSignal, SignalSeverity } from "@/lib/types";

export const GITHUB_SOURCE = "github";

/** How far back an ingestion run looks. */
export const DEFAULT_WINDOW_DAYS = 7;

export type GitHubActivityInput = {
  owner: string;
  repo: string;
  repository: GitHubRepository;
  commits: GitHubCommit[];
  pullRequests: GitHubPullRequest[];
  /** Injected so tests are deterministic and buckets are stable. */
  now?: Date;
  windowDays?: number;
};

function severityFor(count: number, medium: number, high: number): SignalSeverity {
  if (count >= high) return "high";
  if (count >= medium) return "medium";
  return "low";
}

function scoreDeltaFor(severity: SignalSeverity) {
  return severity === "high" ? 8 : severity === "medium" ? 4 : 1;
}

/**
 * Daily bucket for the external id.
 *
 * Aggregate readings need identity that is stable *within* a run window but
 * distinct *across* days. A fully stable id would overwrite history; a fully
 * unique one would duplicate on every re-run. The date bucket gives idempotent
 * re-runs plus a daily time series.
 */
function dayBucket(now: Date) {
  return now.toISOString().slice(0, 10);
}

function withinWindow(iso: string | null | undefined, cutoff: Date) {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= cutoff.getTime();
}

/**
 * Turns a GitHub API reading into observed signals.
 *
 * Pure: all network data arrives as arguments, so this is fully testable and
 * the ingestion job stays a thin wrapper around it.
 */
export function normalizeGitHubActivity(input: GitHubActivityInput): ObservedSignal[] {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const bucket = dayBucket(now);
  const repoRef = `${input.owner}/${input.repo}`;
  const signals: ObservedSignal[] = [];

  // 1. Commit activity in the window.
  const recentCommits = input.commits.filter((commit) =>
    withinWindow(commit.commit?.author?.date, cutoff)
  );
  const commitAuthors = new Set(
    recentCommits.map((c) => c.author?.login ?? c.commit?.author?.name ?? "unknown")
  );
  const commitSeverity = severityFor(recentCommits.length, 3, 10);

  signals.push({
    source: GITHUB_SOURCE,
    externalId: `${repoRef}:commits:${bucket}`,
    kind: "github",
    severity: commitSeverity,
    title: "GitHub commit activity",
    detail: `${recentCommits.length} commits from ${commitAuthors.size} author(s) in the last ${windowDays} days`,
    value: `${recentCommits.length} commits`,
    scoreDelta: scoreDeltaFor(commitSeverity),
    observedAt: now.toISOString(),
    raw: {
      windowDays,
      commitCount: recentCommits.length,
      authorCount: commitAuthors.size,
      latestSha: recentCommits[0]?.sha ?? null
    }
  });

  // 2. Merged pull requests in the window.
  const mergedPrs = input.pullRequests.filter((pr) => withinWindow(pr.merged_at, cutoff));
  const openPrs = input.pullRequests.filter((pr) => pr.state === "open");
  const prSeverity = severityFor(mergedPrs.length, 2, 5);

  signals.push({
    source: GITHUB_SOURCE,
    externalId: `${repoRef}:pull-requests:${bucket}`,
    kind: "github",
    severity: prSeverity,
    title: "GitHub pull request throughput",
    detail: `${mergedPrs.length} merged in the last ${windowDays} days, ${openPrs.length} currently open`,
    value: `${mergedPrs.length} merged`,
    scoreDelta: scoreDeltaFor(prSeverity),
    observedAt: now.toISOString(),
    raw: {
      windowDays,
      mergedCount: mergedPrs.length,
      openCount: openPrs.length,
      latestMerged: mergedPrs[0]?.number ?? null
    }
  });

  // 3. Repository standing. Informational, so it never inflates a score on its
  // own — an archived repo is the one case that matters, and it counts against.
  const archived = input.repository.archived;
  signals.push({
    source: GITHUB_SOURCE,
    externalId: `${repoRef}:repository:${bucket}`,
    kind: "github",
    severity: archived ? "high" : "low",
    title: archived ? "GitHub repository archived" : "GitHub repository profile",
    detail: archived
      ? `${repoRef} is archived and no longer maintained`
      : `${input.repository.stargazers_count} stars, ${input.repository.forks_count} forks, ${input.repository.open_issues_count} open issues`,
    value: archived ? "archived" : `${input.repository.stargazers_count} stars`,
    scoreDelta: archived ? -20 : 1,
    observedAt: now.toISOString(),
    raw: {
      stars: input.repository.stargazers_count,
      forks: input.repository.forks_count,
      openIssues: input.repository.open_issues_count,
      language: input.repository.language,
      pushedAt: input.repository.pushed_at,
      archived
    }
  });

  return signals;
}
