import { runtimeEnv } from "@/lib/env";
import { PARTNER_PATH_ERROR, isSafePartnerPath } from "@/lib/partner-path";

export class OrynthPathError extends Error {
  constructor(path: string) {
    super(`${PARTNER_PATH_ERROR} (received: ${path})`);
    this.name = "OrynthPathError";
  }
}

/**
 * Builds the request URL, pinned to the configured origin.
 *
 * Built with the URL API against an explicit origin rather than by string
 * concatenation, then re-checked. Concatenation is what allowed a caller to
 * redirect the request — and its bearer token — to another host.
 *
 * A path prefix on the base URL (`https://host/v1`) is preserved, which
 * `new URL(path, base)` would otherwise discard.
 */
export function resolvePartnerUrl(baseUrl: string, path: string): URL {
  if (!isSafePartnerPath(path)) {
    throw new OrynthPathError(path);
  }

  const base = new URL(baseUrl);
  const prefix = base.pathname.replace(/\/$/, "");
  const url = new URL(`${prefix}${path}`, base.origin);

  // Defence in depth: the origin must not have moved.
  if (url.origin !== base.origin) {
    throw new OrynthPathError(path);
  }

  return url;
}

export async function fetchOrynthPartnerData(path: string) {
  const url = resolvePartnerUrl(runtimeEnv.orynthApiBaseUrl, path);

  const response = await fetch(url, {
    headers: runtimeEnv.orynthApiKey
      ? { Authorization: `Bearer ${runtimeEnv.orynthApiKey}` }
      : undefined
  });

  if (!response.ok) {
    throw new Error(`Orynth request failed: ${response.status}`);
  }

  return response.json();
}
