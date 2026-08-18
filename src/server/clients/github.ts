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
