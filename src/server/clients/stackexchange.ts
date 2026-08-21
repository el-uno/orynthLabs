/**
 * Stack Exchange client — public, no credentials.
 *
 * Question volume on a topic is attention-family evidence: it measures a
 * community forming around a problem, which is distinct from developers
 * publishing code (builder) or a product's own users complaining (consumer).
 *
 * The anonymous quota is small (300 requests/day per IP), so this is paced
 * alongside the other topic sources rather than called freely.
 */

const API = "https://api.stackexchange.com/2.3";

export class StackExchangeError extends Error {
  readonly rateLimited: boolean;

  constructor(detail: string, rateLimited = false) {
    super(`Stack Exchange request failed: ${detail}`);
    this.name = "StackExchangeError";
    this.rateLimited = rateLimited;
  }
}

export type QuestionVolume = {
  total: number;
  quotaRemaining: number | null;
};

/** Questions mentioning `topic` asked since `sinceEpochSeconds`. */
export async function fetchQuestionVolume(
  topic: string,
  sinceEpochSeconds: number
): Promise<QuestionVolume> {
  const url =
    `${API}/search/advanced?site=stackoverflow&q=${encodeURIComponent(topic)}` +
    `&fromdate=${sinceEpochSeconds}&filter=total`;

  const response = await fetch(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    // 502 is what the API returns when the anonymous quota is exhausted.
    const rateLimited = response.status === 429 || response.status === 502;
    throw new StackExchangeError(`HTTP ${response.status}`, rateLimited);
  }

  const body = (await response.json()) as {
    total?: number;
    quota_remaining?: number;
    error_message?: string;
  };

  if (body.error_message) {
    throw new StackExchangeError(body.error_message);
  }

  return {
    total: typeof body.total === "number" ? body.total : 0,
    quotaRemaining: typeof body.quota_remaining === "number" ? body.quota_remaining : null
  };
}
