import { fetchGitHubRepository } from "@/server/clients/github";
import { fetchOrynthPartnerData } from "@/server/clients/orynth";
import { scoreLaunch } from "@/server/ai/scoring";
import { findLaunchByRepo, listLaunches, upsertLaunchScore } from "@/server/db/launches";
import { listSignalsForScoring } from "@/server/db/signals";
import { insertLaunchSnapshot } from "@/server/db/snapshots";
import { launches as fallbackLaunches } from "@/lib/mock-data";
import type { Launch } from "@/lib/types";

export type LaunchSnapshotInput = {
  owner: string;
  repo: string;
  partnerPath: string;
};

async function resolveLaunch(owner: string, repo: string): Promise<Launch> {
  const byRepo = await findLaunchByRepo(owner, repo);
  if (byRepo) {
    return byRepo;
  }

  const stored = await listLaunches(1);
  if (stored && stored.length > 0) {
    return stored[0];
  }

  return fallbackLaunches[0];
}

export async function buildLaunchSnapshot(input: LaunchSnapshotInput) {
  const [githubRepo, partnerData] = await Promise.all([
    fetchGitHubRepository(input.owner, input.repo),
    fetchOrynthPartnerData(input.partnerPath)
  ]);

  const launch = await resolveLaunch(input.owner, input.repo);
  // Never score on fixtures — see launch-ops.
  const signals = (await listSignalsForScoring(launch.id, 50)) ?? [];

  const scoring = await scoreLaunch({ launch, signals });

  const persisted = await upsertLaunchScore({
    slug: launch.slug,
    name: launch.name,
    symbol: launch.symbol,
    status: scoring.status,
    score: scoring.score === null ? null : Math.round(scoring.score),
    rationale: scoring.rationale,
    recommendation: scoring.opportunity ? null : scoring.assessment.recommendation,
    opportunityVerdict: scoring.opportunity?.verdict ?? null,
    readiness: scoring.opportunity ? undefined : scoring.assessment.readiness
  });

  const projectId = persisted?.id ?? null;

  // Scoring output is persisted with the run that produced it, never written
  // back into signal_events. See migration 0005.
  const snapshotId = await insertLaunchSnapshot({
    projectId,
    source: `github:${input.owner}/${input.repo}`,
    payload: {
      githubRepo,
      partnerData,
      scoring,
      statusDecision: scoring.statusDecision,
      assessment: scoring.assessment
    },
    score: scoring.score,
    status: scoring.status
  });

  return {
    snapshotId,
    launchId: projectId ?? launch.id,
    githubRepo,
    partnerData,
    scoring,
    score: scoring.score,
    status: scoring.status
  };
}
