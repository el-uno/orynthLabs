import {
  SolanaRpcError,
  fetchSignaturesForAddress,
  fetchTokenLargestAccounts,
  fetchTokenSupply
} from "@/server/clients/helius";
import { DEFAULT_CHAIN_WINDOW_DAYS, normalizeChainActivity } from "./helius";
import type { ObservedSignal } from "@/lib/types";

/** Thin IO wrapper; normalization rules stay in the pure module. */
export async function ingestChainActivity(input: {
  mint: string;
  windowDays?: number;
  now?: Date;
}): Promise<ObservedSignal[]> {
  // Sequential, not Promise.all. This is a background job where latency does
  // not matter, and three concurrent requests reliably trip rate limiting on
  // the public fallback RPC.
  const supply = await fetchTokenSupply(input.mint);

  // Providers reject this call on mints with very large holder sets. Treat it
  // as an optional metric: losing concentration should not lose the whole
  // reading. Rate limiting still propagates, since that is worth failing on.
  let largestAccounts: Awaited<ReturnType<typeof fetchTokenLargestAccounts>> = [];
  let largestAccountsAvailable = true;
  try {
    largestAccounts = await fetchTokenLargestAccounts(input.mint);
  } catch (error) {
    if (error instanceof SolanaRpcError && error.rateLimited) {
      throw error;
    }
    largestAccountsAvailable = false;
  }

  const signatures = await fetchSignaturesForAddress(input.mint, 100);

  return normalizeChainActivity({
    mint: input.mint,
    supply,
    largestAccounts,
    largestAccountsAvailable,
    signatures,
    now: input.now ?? new Date(),
    windowDays: input.windowDays ?? DEFAULT_CHAIN_WINDOW_DAYS
  });
}
