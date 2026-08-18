type Env = {
  OPENAI_API_KEY?: string;
  DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  REDIS_URL?: string;
  GITHUB_TOKEN?: string;
  X_API_BEARER_TOKEN?: string;
  HELIUS_API_KEY?: string;
  SOLANA_RPC_URL?: string;
  ORYNTH_API_KEY?: string;
  ORYNTH_API_BASE_URL?: string;
  POOL_CREATOR_SIGNER_KEY?: string;
  LAUNCHER_SIGNER_KEY?: string;
  KMS_KEY_ID?: string;
  API_TOKEN?: string;
  SIGNING_API_TOKEN?: string;
  SIGNING_ALLOWED_PROGRAM_IDS?: string;
  SCHEDULER_ENABLED?: string;
  SCHEDULER_INGEST_CRON?: string;
  SCHEDULER_SCORE_CRON?: string;
  SCHEDULER_TIMEZONE?: string;
};

function env(): Env {
  return process.env as Env;
}

function parseList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Values are read lazily on every access rather than captured at module load.
 * Module-load capture makes the whole config untestable, because importing any
 * consumer freezes whatever `process.env` happened to hold at that moment.
 */
export const runtimeEnv = {
  get openAiApiKey() {
    return env().OPENAI_API_KEY;
  },
  get databaseUrl() {
    return env().DATABASE_URL;
  },
  get supabaseUrl() {
    return env().SUPABASE_URL;
  },
  get supabaseAnonKey() {
    return env().SUPABASE_ANON_KEY;
  },
  get supabaseServiceRoleKey() {
    return env().SUPABASE_SERVICE_ROLE_KEY;
  },
  get redisUrl() {
    return env().REDIS_URL;
  },
  get githubToken() {
    return env().GITHUB_TOKEN;
  },
  get xApiBearerToken() {
    return env().X_API_BEARER_TOKEN;
  },
  get heliusApiKey() {
    return env().HELIUS_API_KEY;
  },
  /** Explicit RPC override. Falls back to public mainnet, which is heavily
   * rate limited but lets chain ingestion run in dev without a Helius key. */
  get solanaRpcUrl() {
    return env().SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
  },
  get orynthApiKey() {
    return env().ORYNTH_API_KEY;
  },
  get orynthApiBaseUrl() {
    return env().ORYNTH_API_BASE_URL ?? "https://api.orynth.example";
  },
  get poolCreatorSignerKey() {
    return env().POOL_CREATOR_SIGNER_KEY;
  },
  get launcherSignerKey() {
    return env().LAUNCHER_SIGNER_KEY;
  },
  get kmsKeyId() {
    return env().KMS_KEY_ID;
  },
  get apiToken() {
    return env().API_TOKEN;
  },
  get signingApiToken() {
    return env().SIGNING_API_TOKEN;
  },
  get signingAllowedProgramIds() {
    return parseList(env().SIGNING_ALLOWED_PROGRAM_IDS);
  },
  /** Master switch. Off by default: a scheduler that starts itself would spend
   * money on external APIs the first time anyone runs a worker. */
  get schedulerEnabled() {
    return env().SCHEDULER_ENABLED === "true";
  },
  get schedulerIngestCron() {
    return env().SCHEDULER_INGEST_CRON ?? "0 */6 * * *";
  },
  /** No default. Scoring calls OpenAI per launch, so it stays off until
   * someone opts in explicitly with a cron expression. */
  get schedulerScoreCron() {
    return env().SCHEDULER_SCORE_CRON;
  },
  get schedulerTimezone() {
    return env().SCHEDULER_TIMEZONE ?? "UTC";
  }
};
