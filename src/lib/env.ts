type Env = {
  OPENAI_API_KEY?: string;
  DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  REDIS_URL?: string;
  GITHUB_TOKEN?: string;
  X_API_BEARER_TOKEN?: string;
  HELIUS_API_KEY?: string;
  ORYNTH_API_KEY?: string;
  POOL_CREATOR_SIGNER_KEY?: string;
  LAUNCHER_SIGNER_KEY?: string;
  KMS_KEY_ID?: string;
};

const env = process.env as Env;

export const runtimeEnv = {
  openAiApiKey: env.OPENAI_API_KEY,
  databaseUrl: env.DATABASE_URL,
  supabaseUrl: env.SUPABASE_URL,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  redisUrl: env.REDIS_URL,
  githubToken: env.GITHUB_TOKEN,
  xApiBearerToken: env.X_API_BEARER_TOKEN,
  heliusApiKey: env.HELIUS_API_KEY,
  orynthApiKey: env.ORYNTH_API_KEY,
  poolCreatorSignerKey: env.POOL_CREATOR_SIGNER_KEY,
  launcherSignerKey: env.LAUNCHER_SIGNER_KEY,
  kmsKeyId: env.KMS_KEY_ID
};
