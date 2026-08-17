import { runtimeEnv } from "@/lib/env";

export async function fetchGitHubRepository(owner: string, repo: string) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json"
  };

  if (runtimeEnv.githubToken) {
    headers.Authorization = `Bearer ${runtimeEnv.githubToken}`;
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status}`);
  }

  return response.json();
}
