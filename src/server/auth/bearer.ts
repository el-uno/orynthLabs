import { timingSafeEqual } from "node:crypto";
import { runtimeEnv } from "@/lib/env";

export type AuthResult = { ok: true } | { ok: false; status: number; error: string };

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  // timingSafeEqual throws on length mismatch, so compare lengths first. The
  // length of a bearer token is not the secret; its contents are.
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

/**
 * Shared bearer-token check. Fails closed: an unconfigured secret disables the
 * route rather than admitting anonymous callers.
 */
export function authorizeBearer(
  request: Request,
  expected: string | undefined,
  missingSecretError: string
): AuthResult {
  if (!expected) {
    return { ok: false, status: 503, error: missingSecretError };
  }

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }

  const presented = header.slice("Bearer ".length).trim();
  if (!safeEqual(presented, expected)) {
    return { ok: false, status: 401, error: "Invalid bearer token" };
  }

  return { ok: true };
}

/**
 * Guards general API routes that cost money or write to the database.
 */
export function authorizeApiRequest(request: Request): AuthResult {
  return authorizeBearer(
    request,
    runtimeEnv.apiToken,
    "API_TOKEN is not configured; this endpoint is disabled"
  );
}
