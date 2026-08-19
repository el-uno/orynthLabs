/**
 * Validation for caller-supplied partner API paths.
 *
 * The Orynth client used to build its URL by concatenation, so a path could
 * change the host outright: `https://api.orynth.io` + `@evil.com/x` parses
 * `api.orynth.io` as userinfo and `evil.com` as the host. Because the client
 * attaches `Authorization: Bearer $ORYNTH_API_KEY`, that sent the partner API
 * key to a caller-chosen server.
 *
 * Shared between the request schema and the client so the rule is enforced at
 * the edge and again at the last line before the network.
 */
export function isSafePartnerPath(path: string): boolean {
  // Must be a plain absolute path.
  if (!path.startsWith("/")) {
    return false;
  }

  // Protocol-relative: `//evil.com` becomes a host once a scheme is prepended.
  if (path.startsWith("//")) {
    return false;
  }

  // `@` re-points the host; backslash and whitespace confuse URL parsing.
  if (/[@\\\s]/.test(path)) {
    return false;
  }

  // Traversal can escape a configured path prefix (base `/v1` + `/../admin`).
  if (path.split(/[/?#]/).some((segment) => segment === "..")) {
    return false;
  }

  return true;
}

export const PARTNER_PATH_ERROR =
  "partnerPath must be an absolute path such as /partners/atlas, with no host, traversal, or '@'";
