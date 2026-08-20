/**
 * npm registry client — public, no credentials.
 *
 * Used as market-structure evidence, not builder evidence: we are asking "does
 * a maintained solution to this problem already exist?", not "is someone
 * committing code?". The family a signal belongs to is decided by what it
 * means, never by which API produced it.
 */

const REGISTRY = "https://registry.npmjs.org";
const DOWNLOADS = "https://api.npmjs.org";

export class NpmError extends Error {
  readonly rateLimited: boolean;

  constructor(detail: string, rateLimited = false) {
    super(`npm request failed: ${detail}`);
    this.name = "NpmError";
    this.rateLimited = rateLimited;
  }
}

export type NpmPackage = {
  name: string;
  description?: string;
  /** ISO date of the most recent publish. */
  date?: string;
  links?: { npm?: string; repository?: string };
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    const rateLimited = response.status === 429;
    throw new NpmError(`HTTP ${response.status} ${url}`, rateLimited);
  }

  return response.json() as Promise<T>;
}

/**
 * Searches the registry.
 *
 * Deliberately returns only the packages. The endpoint also reports a `total`
 * and per-result `score` object, and both are unusable: `total` is a loose
 * full-text match count (a niche query like "agent treasury" reports >120,000
 * matches), and the score fields are out of their documented 0-1 range with
 * `quality` pinned at exactly 1.0 for every result. Coverage is derived from
 * observable facts instead — real downloads and real publish dates.
 */
export async function searchNpmPackages(query: string, size = 20): Promise<NpmPackage[]> {
  const url = `${REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`;
  const body = await getJson<{ objects: { package: NpmPackage }[] }>(url);
  return body.objects.map((entry) => entry.package);
}

/** Weekly downloads, or null when the registry has no figure for the package. */
export async function fetchWeeklyDownloads(packageName: string): Promise<number | null> {
  try {
    const body = await getJson<{ downloads?: number }>(
      `${DOWNLOADS}/downloads/point/last-week/${packageName}`
    );
    return typeof body.downloads === "number" ? body.downloads : null;
  } catch (error) {
    // A missing download record is normal for very new or private-scoped
    // packages and must not fail the whole reading. Rate limiting must.
    if (error instanceof NpmError && error.rateLimited) {
      throw error;
    }
    return null;
  }
}
