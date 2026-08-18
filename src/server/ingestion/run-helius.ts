import {
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
  const largestAccounts = await fetchTokenLargestAccounts(input.mint);
  const signatures = await fetchSignaturesForAddress(input.mint, 100);

  return normalizeChainActivity({
    mint: input.mint,
    supply,
    largestAccounts,
    signatures,
    now: input.now ?? new Date(),
    windowDays: input.windowDays ?? DEFAULT_CHAIN_WINDOW_DAYS
  });
}
