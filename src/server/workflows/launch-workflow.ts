import { fetchGitHubRepository } from "@/server/clients/github";
import { fetchOrynthPartnerData } from "@/server/clients/orynth";
import { scoreLaunch } from "@/server/ai/scoring";
import { launches, signals } from "@/lib/mock-data";

export async function buildLaunchSnapshot(input: {
  owner: string;
  repo: string;
  partnerPath: string;
}) {
  const [githubRepo, partnerData] = await Promise.all([
    fetchGitHubRepository(input.owner, input.repo),
    fetchOrynthPartnerData(input.partnerPath)
  ]);
  const launch = launches[0];
  const scoring = await scoreLaunch({ launch, signals });

  return {
    githubRepo,
    partnerData,
    scoring,
    score: scoring.score,
    status: scoring.status
  };
}
