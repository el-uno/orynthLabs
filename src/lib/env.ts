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
  SIGNING_API_TOKEN?: string;
  SIGNING_ALLOWED_PROGRAM_IDS?: string;
};

const env = process.env as Env;

function parseList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const runtimeEnv = {
  openAiApiKey: env.OPENAI_API_KEY,
  databaseUrl: env.DATABASE_URL,
  supabaseUrl: env.SUPABASE_URL,
  supabaseAnonKey: env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  redisUrl: env.REDIS_URL,
  githubToken: env.GITHUB_TOKEN,
  xApiBearerToken: env.X_API_BEARER_TOKEN,
  heliusApiKey: env.HELIUS_API_KEY,
  orynthApiKey: env.ORYNTH_API_KEY,
  orynthApiBaseUrl: env.ORYNTH_API_BASE_URL ?? "https://api.orynth.example",
  poolCreatorSignerKey: env.POOL_CREATOR_SIGNER_KEY,
  launcherSignerKey: env.LAUNCHER_SIGNER_KEY,
  kmsKeyId: env.KMS_KEY_ID,
  signingApiToken: env.SIGNING_API_TOKEN,
  signingAllowedProgramIds: parseList(env.SIGNING_ALLOWED_PROGRAM_IDS)
};
