import type {
  SignatureInfo,
  TokenLargestAccount,
  TokenSupply
} from "@/server/clients/helius";
import type { ObservedSignal, SignalSeverity } from "@/lib/types";

export const CHAIN_SOURCE = "helius";
export const DEFAULT_CHAIN_WINDOW_DAYS = 7;

export type ChainActivityInput = {
  mint: string;
  supply: TokenSupply;
  largestAccounts: TokenLargestAccount[];
  signatures: SignatureInfo[];
  /**
   * False when the holder query could not be answered — RPC providers refuse
   * getTokenLargestAccounts on mints with millions of token accounts. The
   * concentration signal is then omitted rather than reported as 0%, which
   * would read as "perfectly distributed" and be actively misleading.
   */
  largestAccountsAvailable?: boolean;
  now?: Date;
  windowDays?: number;
};

function dayBucket(now: Date) {
  return now.toISOString().slice(0, 10);
}

function scoreDeltaFor(severity: SignalSeverity) {
  return severity === "high" ? 8 : severity === "medium" ? 4 : 1;
}

/**
 * Share of circulating supply held by the largest `n` accounts.
 *
 * Uses raw base-unit strings via BigInt rather than uiAmount floats. A token
 * with 9 decimals and a 1e9 nominal supply has 1e18 base units, far beyond
 * 2^53, where float arithmetic silently loses precision.
 */
export function topHolderShare(
  supply: TokenSupply,
  accounts: TokenLargestAccount[],
  n = 10
): number {
  let total: bigint;
  try {
    total = BigInt(supply.amount);
  } catch {
    return 0;
  }

  if (total === 0n) {
    return 0;
  }

  const held = accounts.slice(0, n).reduce((sum, account) => {
    try {
      return sum + BigInt(account.amount);
    } catch {
      return sum;
    }
  }, 0n);

  // Scale before dividing so integer division keeps four significant digits.
  return Number((held * 10000n) / total) / 100;
}

/**
 * Turns a chain reading into observed signals.
 *
 * Pure: all RPC data arrives as arguments. Concentration and failure rate are
 * *risk* signals and carry negative score deltas — they should pull a launch
 * score down, not up, however "active" the token looks.
 */
export function normalizeChainActivity(input: ChainActivityInput): ObservedSignal[] {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? DEFAULT_CHAIN_WINDOW_DAYS;
  const cutoffSeconds = Math.floor((now.getTime() - windowDays * 86400000) / 1000);
  const bucket = dayBucket(now);
  const signals: ObservedSignal[] = [];

  // 1. Transaction activity in the window.
  const recent = input.signatures.filter(
    (sig) => sig.blockTime !== null && sig.blockTime >= cutoffSeconds
  );
  const failed = recent.filter((sig) => sig.err !== null);
  const activitySeverity: SignalSeverity =
    recent.length >= 100 ? "high" : recent.length >= 20 ? "medium" : "low";

  signals.push({
    source: CHAIN_SOURCE,
    externalId: `${input.mint}:tx-activity:${bucket}`,
    kind: "onchain",
    severity: activitySeverity,
    title: "On-chain transaction activity",
    detail: `${recent.length} transactions in the last ${windowDays} days, ${failed.length} failed`,
    value: `${recent.length} txs`,
    scoreDelta: scoreDeltaFor(activitySeverity),
    observedAt: now.toISOString(),
    raw: {
      windowDays,
      transactionCount: recent.length,
      failedCount: failed.length,
      latestSlot: recent[0]?.slot ?? null
    }
  });

  // 2. Holder concentration — a risk signal, so the delta is negative.
  // Skipped when the holder query failed: an absent signal is honest, a 0%
  // signal is a false all-clear.
  if (input.largestAccountsAvailable !== false) {
  const share = topHolderShare(input.supply, input.largestAccounts, 10);
  const concentrationSeverity: SignalSeverity =
    share >= 80 ? "high" : share >= 50 ? "medium" : "low";

  signals.push({
    source: CHAIN_SOURCE,
    externalId: `${input.mint}:holder-concentration:${bucket}`,
    kind: "onchain",
    severity: concentrationSeverity,
    title: "Token holder concentration",
    detail: `Top 10 accounts hold ${share.toFixed(2)}% of supply across ${input.largestAccounts.length} tracked accounts`,
    value: `${share.toFixed(1)}% top-10`,
    // Concentration counts against a launch. The more concentrated, the worse.
    scoreDelta:
      concentrationSeverity === "high" ? -12 : concentrationSeverity === "medium" ? -5 : 0,
    observedAt: now.toISOString(),
    raw: {
      topTenSharePercent: share,
      trackedAccounts: input.largestAccounts.length,
      supply: input.supply.amount,
      decimals: input.supply.decimals
    }
  });
  }

  // 3. Supply reference. Informational context for the other two.
  signals.push({
    source: CHAIN_SOURCE,
    externalId: `${input.mint}:supply:${bucket}`,
    kind: "onchain",
    severity: "low",
    title: "Token supply",
    detail: `Supply ${input.supply.uiAmount ?? input.supply.amount} at ${input.supply.decimals} decimals`,
    value: String(input.supply.uiAmount ?? input.supply.amount),
    scoreDelta: 0,
    observedAt: now.toISOString(),
    raw: { amount: input.supply.amount, decimals: input.supply.decimals, uiAmount: input.supply.uiAmount }
  });

  return signals;
}
