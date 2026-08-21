import { searchGitHubRepositories } from "@/server/clients/github";
import { StackExchangeError, fetchQuestionVolume } from "@/server/clients/stackexchange";
import { DEFAULT_WINDOW_DAYS, normalizeTopicDemand } from "./topic-demand";
import type { ObservedSignal } from "@/lib/types";

/**
 * Thin IO wrapper. Two independent sources, so a failure in one must not cost
 * the other: attention is optional, builder is not.
 */
export async function ingestTopicDemand(input: {
  topic: string;
  windowDays?: number;
  now?: Date;
}): Promise<ObservedSignal[]> {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const since = new Date(now.getTime() - windowDays * 86400000);

  const repos = await searchGitHubRepositories(input.topic, since.toISOString().slice(0, 10));

  let communityQuestions: number | null = null;
  try {
    const volume = await fetchQuestionVolume(input.topic, Math.floor(since.getTime() / 1000));
    communityQuestions = volume.total;
  } catch (error) {
    // Quota exhaustion loses the attention signal for this run; it must not
    // lose the builder signal too. Reported as absent, never as zero.
    if (!(error instanceof StackExchangeError)) {
      throw error;
    }
  }

  return normalizeTopicDemand({
    topic: input.topic,
    newRepositories: repos.total_count,
    topStars: repos.items[0]?.stargazers_count ?? 0,
    communityQuestions,
    now,
    windowDays
  });
}
