import { fetchGitHubIssueCount, fetchGitHubIssues } from "@/server/clients/github";
import { DEFAULT_WINDOW_DAYS, normalizeConsumerActivity } from "./consumer";
import type { ObservedSignal } from "@/lib/types";

/** Thin IO wrapper; every judgement lives in the pure normalizer. */
export async function ingestConsumerActivity(input: {
  owner: string;
  repo: string;
  windowDays?: number;
  now?: Date;
}): Promise<ObservedSignal[]> {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const since = new Date(now.getTime() - windowDays * 86400000).toISOString();

  const issues = await fetchGitHubIssues(input.owner, input.repo, since);
  // Volume comes from search (exact); ratios come from the sample.
  const totalCount = await fetchGitHubIssueCount(
    input.owner,
    input.repo,
    since.slice(0, 10)
  );

  return normalizeConsumerActivity({
    owner: input.owner,
    repo: input.repo,
    issues,
    totalCount,
    now,
    windowDays
  });
}
