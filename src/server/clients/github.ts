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

async function githubGet<T>(path: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders() });

  if (!response.ok) {
    // Rate limiting is the failure this hits most often when unauthenticated,
    // so name it rather than leaving a bare status code.
    const remaining = response.headers.get("x-ratelimit-remaining");
    const rateLimited = response.status === 403 && remaining === "0";
    throw new Error(
      rateLimited
        ? `GitHub rate limit exhausted (set GITHUB_TOKEN to raise it): ${path}`
        : `GitHub request failed: ${response.status} ${path}`
    );
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
