import { runtimeEnv } from "@/lib/env";
import { authorizeBearer, type AuthResult } from "@/server/auth/bearer";

export type { AuthResult };

/**
 * Guards backend signing entry points.
 *
 * Deliberately a different secret from API_TOKEN: holding the general API token
 * must not grant the ability to queue work for the authority keys.
 */
export function authorizeSigningRequest(request: Request): AuthResult {
  return authorizeBearer(
    request,
    runtimeEnv.signingApiToken,
    "SIGNING_API_TOKEN is not configured; signing endpoint is disabled"
  );
}
