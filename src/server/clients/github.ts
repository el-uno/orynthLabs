import { runtimeEnv } from "@/lib/env";

const GITHUB_API = "https://api.github.com";

function githubHeaders() {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  if (runtimeEnv.githubToken) {
    headers.Authorization = `Bearer ${runtimeEnv.githubToken}`;
  }

  return headers;
}

/**
 * Rate limiting is not a transient fault: the window resets on the hour, so
 * retrying seconds later always fails. Typed so callers can fail fast instead
 * of burning their retry budget.
 */
export class GitHubRateLimitError extends Error {
  readonly resetAt: Date | null;

  constructor(path: string, resetAt: Date | null) {
    const when = resetAt ? ` (resets ${resetAt.toISOString()})` : "";
    super(`GitHub rate limit exhausted${when}; set GITHUB_TOKEN to raise it: ${path}`);
    this.name = "GitHubRateLimitError";
    this.resetAt = resetAt;
  }
}

async function githubGet<T>(path: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders() });

  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const rateLimited =
      (response.status === 403 || response.status === 429) && remaining === "0";

    if (rateLimited) {
      const resetHeader = response.headers.get("x-ratelimit-reset");
      const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000) : null;
      throw new GitHubRateLimitError(path, resetAt);
    }

    throw new Error(`GitHub request failed: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}

export type GitHubRepository = {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  subscribers_count?: number;
  pushed_at: string | null;
  created_at: string;
  archived: boolean;
  language: string | null;
};

export type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    author: { name?: string; date?: string } | null;
  };
  author: { login?: string } | null;
};

export type GitHubPullRequest = {
  number: number;
  title: string;
  state: string;
  created_at: string;
  merged_at: string | null;
  closed_at: string | null;
  user: { login?: string } | null;
};

export function fetchGitHubRepository(owner: string, repo: string) {
  return githubGet<GitHubRepository>(`/repos/${owner}/${repo}`);
}

/** Commits pushed since `since` (ISO 8601). Capped at one page — this is a
 * signal feed, not an archive. */
export function fetchGitHubCommits(owner: string, repo: string, since: string) {
  return githubGet<GitHubCommit[]>(
    `/repos/${owner}/${repo}/commits?since=${encodeURIComponent(since)}&per_page=100`
  );
}

/** Recently updated pull requests, newest first. Filtering by date happens in
 * the normalizer, because the list endpoint cannot filter by merge time. */
export function fetchGitHubPullRequests(owner: string, repo: string) {
  return githubGet<GitHubPullRequest[]>(
    `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100`
  );
}

export type GitHubIssue = {
  number: number;
  title: string;
  state: string;
  created_at: string;
  closed_at: string | null;
  comments: number;
  labels: { name: string }[];
  user: { login?: string } | null;
  /** Present only on pull requests. The issues endpoint returns both. */
  pull_request?: unknown;
};

/**
 * Issues opened since `since` (ISO 8601).
 *
 * The endpoint returns pull requests as well as issues — measured against
 * vercel/next.js, 80 of 100 items were PRs. Callers must filter, or they end up
 * measuring maintainer activity (builder evidence) while believing they are
 * measuring user voice.
 */
export function fetchGitHubIssues(owner: string, repo: string, since: string) {
  return githubGet<GitHubIssue[]>(
    `/repos/${owner}/${repo}/issues?state=all&since=${encodeURIComponent(since)}&per_page=100`
  );
}

/**
 * Exact count of issues created since `sinceDate` (YYYY-MM-DD).
 *
 * The list endpoint returns one page mixed with pull requests, which
 * undercounts badly on busy repositories — vercel/next.js reported 20 issues
 * from a page of 100 against a true 289. Worse, it undercounts *most* for the
 * products with the most users, inverting the very signal it feeds. Search
 * filters `is:issue` server-side and returns an exact total in one request.
 *
 * Search has a much tighter budget than the core API (30 requests/minute
 * authenticated), so it is used only for the count, never per-issue.
 */
export async function fetchGitHubIssueCount(
  owner: string,
  repo: string,
  sinceDate: string
): Promise<number | null> {
  try {
    const q = `repo:${owner}/${repo} is:issue created:>=${sinceDate}`;
    const body = await githubGet<{ total_count?: number }>(
      `/search/issues?q=${encodeURIComponent(q)}&per_page=1`
    );
    return typeof body.total_count === "number" ? body.total_count : null;
  } catch (error) {
    // A missing count degrades the reading; it must not fail the ingestion.
    // Rate limiting still propagates so the worker can fail fast.
    if (error instanceof GitHubRateLimitError) {
      throw error;
    }
    return null;
  }
}

export type GitHubRepoSearch = {
  total_count: number;
  items: { full_name: string; stargazers_count: number; created_at: string }[];
};

/**
 * Repositories matching a topic, created since `sinceDate` (YYYY-MM-DD).
 *
 * Topic-scoped rather than repo-scoped: this asks "are developers building in
 * this space", which is builder-family demand for a market gap, not activity
 * within one project.
 *
 * Search has a tighter budget than the core API (30 requests/minute
 * authenticated), so callers must pace.
 */
export function searchGitHubRepositories(topic: string, sinceDate: string) {
  const q = `${topic} created:>=${sinceDate}`;
  return githubGet<GitHubRepoSearch>(
    `/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=5`
  );
}
