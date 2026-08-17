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
  ORYNTH_API_KEY?: string;
  ORYNTH_API_BASE_URL?: string;
  POOL_CREATOR_SIGNER_KEY?: string;
  LAUNCHER_SIGNER_KEY?: string;
  KMS_KEY_ID?: string;
  API_TOKEN?: string;
  SIGNING_API_TOKEN?: string;
  SIGNING_ALLOWED_PROGRAM_IDS?: string;
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
  }
};
