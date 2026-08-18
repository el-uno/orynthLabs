import {
  fetchGitHubCommits,
  fetchGitHubPullRequests,
  fetchGitHubRepository
} from "@/server/clients/github";
import {
  DEFAULT_WINDOW_DAYS,
  normalizeGitHubActivity
} from "./github";
import type { ObservedSignal } from "@/lib/types";

/**
 * Thin IO wrapper: fetches a repository reading and hands it to the pure
 * normalizer. Kept separate so the normalization rules stay unit-testable.
 */
export async function ingestGitHubActivity(input: {
  owner: string;
  repo: string;
  windowDays?: number;
  now?: Date;
}): Promise<ObservedSignal[]> {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const [repository, commits, pullRequests] = await Promise.all([
    fetchGitHubRepository(input.owner, input.repo),
    fetchGitHubCommits(input.owner, input.repo, since),
    fetchGitHubPullRequests(input.owner, input.repo)
  ]);

  return normalizeGitHubActivity({
    owner: input.owner,
    repo: input.repo,
    repository,
    commits,
    pullRequests,
    now,
    windowDays
  });
}
