import { fetchGitHubRepository } from "@/server/clients/github";
import { fetchOrynthPartnerData } from "@/server/clients/orynth";

export async function buildLaunchSnapshot(input: {
  owner: string;
  repo: string;
  partnerPath: string;
}) {
  const [githubRepo, partnerData] = await Promise.all([
    fetchGitHubRepository(input.owner, input.repo),
    fetchOrynthPartnerData(input.partnerPath)
  ]);

  return {
    githubRepo,
    partnerData,
    score: 0,
    status: "draft" as const
  };
}
