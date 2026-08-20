import { supabaseAdmin } from "./client";
import { launchStatusSchema } from "@/lib/schema";
import { READINESS_DIMENSIONS } from "@/lib/types";
import type {
  EntityKind,
  Launch,
  LaunchRecommendation,
  LaunchStatus,
  Readiness
} from "@/lib/types";

type LaunchRow = {
  id: string;
  slug: string;
  name: string;
  entity_kind: string;
  symbol: string | null;
  chain: string | null;
  market_topic: string | null;
  recommendation: string | null;
  readiness: Record<string, unknown> | null;
  status: string;
  score: number;
  github_owner: string | null;
  github_repo: string | null;
  partner_ref: string | null;
  updated_at: string;
};

const LAUNCH_COLUMNS =
  "id, slug, name, entity_kind, symbol, chain, status, score, market_topic, recommendation, readiness, " +
  "github_owner, github_repo, partner_ref, updated_at";

function toStatus(value: string): LaunchStatus {
  const parsed = launchStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "draft";
}

/** Fills absent dimensions with null — unmeasured, not zero. */
function toReadiness(raw: Record<string, unknown> | null): Readiness {
  const readiness = {} as Readiness;
  for (const dimension of READINESS_DIMENSIONS) {
    const value = raw?.[dimension];
    readiness[dimension] = typeof value === "number" ? value : null;
  }
  return readiness;
}

function toLaunch(row: LaunchRow): Launch {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    entityKind: (row.entity_kind === "opportunity" ? "opportunity" : "company") as EntityKind,
    symbol: row.symbol,
    status: toStatus(row.status),
    score: row.score,
    chain: row.chain,
    marketTopic: row.market_topic,
    recommendation: (row.recommendation as LaunchRecommendation | null) ?? null,
    readiness: toReadiness(row.readiness),
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
    .select(LAUNCH_COLUMNS)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list launches: ${error.message}`);
  }

  return (data as unknown as LaunchRow[]).map(toLaunch);
}

export async function findLaunchById(id: string): Promise<Launch | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .select(LAUNCH_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load launch ${id}: ${error.message}`);
  }

  return data ? toLaunch(data as unknown as LaunchRow) : null;
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
    .select(LAUNCH_COLUMNS)
    .eq("github_owner", owner)
    .eq("github_repo", repo)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load launch for ${owner}/${repo}: ${error.message}`);
  }

  return data ? toLaunch(data as unknown as LaunchRow) : null;
}

/**
 * Upserts on `slug` (migration 0007).
 *
 * Previously keyed on `symbol`, which required every tracked entity to have a
 * ticker — excluding exactly the early-stage products this system exists to
 * assess. Slug is identity that does not depend on a token existing.
 */
export async function upsertLaunchScore(input: {
  slug: string;
  name: string;
  symbol?: string | null;
  status: LaunchStatus;
  score: number;
  rationale: string;
  recommendation?: LaunchRecommendation | null;
  readiness?: Readiness;
}): Promise<Launch | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .upsert(
      {
        slug: input.slug,
        name: input.name,
        symbol: input.symbol ?? null,
        status: input.status,
        score: input.score,
        recommendation: input.recommendation ?? null,
        ...(input.readiness ? { readiness: input.readiness } : {}),
        metadata: { rationale: input.rationale }
      },
      { onConflict: "slug" }
    )
    .select(LAUNCH_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to upsert launch ${input.slug}: ${error.message}`);
  }

  return toLaunch(data as unknown as LaunchRow);
}

export type LaunchRepoRef = {
  id: string;
  slug: string;
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
    .select("id, slug, github_owner, github_repo")
    .not("github_owner", "is", null)
    .not("github_repo", "is", null)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list launches with repos: ${error.message}`);
  }

  return (
    data as unknown as { id: string; slug: string; github_owner: string; github_repo: string }[]
  ).map((row) => ({ id: row.id, slug: row.slug, owner: row.github_owner, repo: row.github_repo }));
}

export async function findLaunchByMint(mint: string): Promise<Launch | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .select(LAUNCH_COLUMNS)
    .eq("token_mint", mint)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load launch for mint ${mint}: ${error.message}`);
  }

  return data ? toLaunch(data as unknown as LaunchRow) : null;
}

export type LaunchMintRef = {
  id: string;
  slug: string;
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
    .select("id, slug, token_mint")
    .not("token_mint", "is", null)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list launches with mints: ${error.message}`);
  }

  return (data as unknown as { id: string; slug: string; token_mint: string }[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    mint: row.token_mint
  }));
}

export type LaunchTopicRef = {
  id: string;
  slug: string;
  topic: string;
};

/** Entities that declare a market topic. The market sweep fans out over this. */
export async function listLaunchesWithMarketTopic(
  limit = 200
): Promise<LaunchTopicRef[] | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .select("id, slug, market_topic")
    .not("market_topic", "is", null)
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list launches with market topics: ${error.message}`);
  }

  return (data as unknown as { id: string; slug: string; market_topic: string }[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    topic: row.market_topic
  }));
}

export async function findLaunchByMarketTopic(topic: string): Promise<Launch | null> {
  if (!supabaseAdmin) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("launch_projects")
    .select(LAUNCH_COLUMNS)
    .eq("market_topic", topic)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load launch for topic ${topic}: ${error.message}`);
  }

  return data ? toLaunch(data as unknown as LaunchRow) : null;
}
