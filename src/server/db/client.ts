import { createClient } from "@supabase/supabase-js";
import { runtimeEnv } from "@/lib/env";

export const supabaseAdmin =
  runtimeEnv.supabaseUrl && runtimeEnv.supabaseServiceRoleKey
    ? createClient(runtimeEnv.supabaseUrl, runtimeEnv.supabaseServiceRoleKey, {
        auth: { persistSession: false }
      })
    : null;
