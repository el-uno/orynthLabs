import { timingSafeEqual } from "node:crypto";
import { runtimeEnv } from "@/lib/env";

export type AuthResult = { ok: true } | { ok: false; status: number; error: string };

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

/**
 * Guards backend signing entry points. Fails closed: with no configured token
 * the route refuses service rather than accepting anonymous callers.
 */
export function authorizeSigningRequest(request: Request): AuthResult {
  const expected = runtimeEnv.signingApiToken;

  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: "SIGNING_API_TOKEN is not configured; signing endpoint is disabled"
    };
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
