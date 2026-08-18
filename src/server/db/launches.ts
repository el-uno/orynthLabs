import { supabaseAdmin } from "./client";
import { launchStatusSchema } from "@/lib/schema";
import type { Launch, LaunchStatus } from "@/lib/types";

type LaunchRow = {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  status: string;
  score: number;
  github_owner: string | null;
  github_repo: string | null;
  partner_ref: string | null;
  updated_at: string;
};

function toStatus(value: string): LaunchStatus {
  const parsed = launchStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "draft";
}

function toLaunch(row: LaunchRow): Launch {
  return {
    id: row.id,
    name: row.name,
    symbol: row.symbol,
    status: toStatus(row.status),
    score: row.score,
    chain: "Solana",
    updatedAt: row.updated_at
  };
}

/**
 * Returns null (rather than an empty list) when Supabase is unconfigured, so
 * callers can distinguish "no database" from "database with no rows".
 */
export async function listLaunches(limit = 50): Promise<Launch[] | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .select(
      "id, name, symbol, chain, status, score, github_owner, github_repo, partner_ref, updated_at"
    )
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list launches: ${error.message}`);
  }

  return (data as LaunchRow[]).map(toLaunch);
}

export async function findLaunchById(id: string): Promise<Launch | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .select(
      "id, name, symbol, chain, status, score, github_owner, github_repo, partner_ref, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load launch ${id}: ${error.message}`);
  }

  return data ? toLaunch(data as LaunchRow) : null;
}

export async function findLaunchByRepo(
  owner: string,
  repo: string
): Promise<Launch | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .select(
      "id, name, symbol, chain, status, score, github_owner, github_repo, partner_ref, updated_at"
    )
    .eq("github_owner", owner)
    .eq("github_repo", repo)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load launch for ${owner}/${repo}: ${error.message}`);
  }

  return data ? toLaunch(data as LaunchRow) : null;
}

/**
 * Upserts on `symbol`, which migration 0002 makes unique. Without an explicit
 * conflict target every scoring run would append a duplicate row.
 */
export async function upsertLaunchScore(input: {
  name: string;
  symbol: string;
  status: LaunchStatus;
  score: number;
  rationale: string;
}): Promise<Launch | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .upsert(
      {
        name: input.name,
        symbol: input.symbol,
        status: input.status,
        score: input.score,
        chain: "Solana",
        metadata: { rationale: input.rationale }
      },
      { onConflict: "symbol" }
    )
    .select(
      "id, name, symbol, chain, status, score, github_owner, github_repo, partner_ref, updated_at"
    )
    .single();

  if (error) {
    throw new Error(`Failed to upsert launch ${input.symbol}: ${error.message}`);
  }

  return toLaunch(data as LaunchRow);
}

export type LaunchRepoRef = {
  id: string;
  symbol: string;
  owner: string;
  repo: string;
};

/**
 * Launches that name a GitHub repository. The scheduler fans out over this,
 * so newly added launches are picked up without touching the cron config.
 */
export async function listLaunchesWithGitHubRepo(
  limit = 200
): Promise<LaunchRepoRef[] | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .select("id, symbol, github_owner, github_repo")
    .not("github_owner", "is", null)
    .not("github_repo", "is", null)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list launches with repos: ${error.message}`);
  }

  return (data as { id: string; symbol: string; github_owner: string; github_repo: string }[]).map(
    (row) => ({ id: row.id, symbol: row.symbol, owner: row.github_owner, repo: row.github_repo })
  );
}

export async function findLaunchByMint(mint: string): Promise<Launch | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .select(
      "id, name, symbol, chain, status, score, github_owner, github_repo, partner_ref, updated_at"
    )
    .eq("token_mint", mint)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load launch for mint ${mint}: ${error.message}`);
  }

  return data ? toLaunch(data as LaunchRow) : null;
}

export type LaunchMintRef = {
  id: string;
  symbol: string;
  mint: string;
};

/** Launches that name a token mint. The chain sweep fans out over this. */
export async function listLaunchesWithTokenMint(
  limit = 200
): Promise<LaunchMintRef[] | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .select("id, symbol, token_mint")
    .not("token_mint", "is", null)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list launches with mints: ${error.message}`);
  }

  return (data as { id: string; symbol: string; token_mint: string }[]).map((row) => ({
    id: row.id,
    symbol: row.symbol,
    mint: row.token_mint
  }));
}
