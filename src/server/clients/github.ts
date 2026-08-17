import { runtimeEnv } from "@/lib/env";

export async function fetchGitHubRepository(owner: string, repo: string) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: runtimeEnv.githubToken
        ? `Bearer ${runtimeEnv.githubToken}`
        : undefined
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status}`);
  }

  return response.json();
}
