import { runtimeEnv } from "@/lib/env";

/**
 * Resolves the RPC endpoint.
 *
 * Helius when a key is configured; otherwise the public mainnet endpoint (or
 * SOLANA_RPC_URL). The fallback is heavily rate limited and is there so chain
 * ingestion is runnable in development without provisioning a Helius key.
 */
export function resolveRpcUrl() {
  return runtimeEnv.heliusApiKey
    ? `https://mainnet.helius-rpc.com/?api-key=${runtimeEnv.heliusApiKey}`
    : runtimeEnv.solanaRpcUrl;
}

export class SolanaRpcError extends Error {
  /** True when the endpoint refused for rate-limit reasons. Not transient on
   * the timescale of a retry, so callers should fail fast rather than burn
   * their attempt budget — same reasoning as GitHubRateLimitError. */
  readonly rateLimited: boolean;

  constructor(method: string, detail: string, rateLimited = false) {
    super(`Solana RPC ${method} failed: ${detail}`);
    this.name = "SolanaRpcError";
    this.rateLimited = rateLimited;
  }
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(resolveRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "orynth-productlab", method, params })
  });

  if (!response.ok) {
    const rateLimited = response.status === 429;
    throw new SolanaRpcError(
      method,
      rateLimited
        ? "HTTP 429 rate limited (set HELIUS_API_KEY; the public fallback RPC is heavily throttled)"
        : `HTTP ${response.status}`,
      rateLimited
    );
  }

  const body = (await response.json()) as { result?: T; error?: { message?: string } };

  if (body.error) {
    throw new SolanaRpcError(method, body.error.message ?? "unknown RPC error");
  }

  if (body.result === undefined) {
    throw new SolanaRpcError(method, "response contained no result");
  }

  return body.result;
}

export type TokenSupply = {
  amount: string;
  decimals: number;
  uiAmount: number | null;
};

export type TokenLargestAccount = {
  address: string;
  amount: string;
  decimals: number;
  uiAmount: number | null;
};

export type SignatureInfo = {
  signature: string;
  slot: number;
  err: unknown | null;
  blockTime: number | null;
};

export function fetchTokenSupply(mint: string) {
  return rpc<{ value: TokenSupply }>("getTokenSupply", [mint]).then((r) => r.value);
}

export function fetchTokenLargestAccounts(mint: string) {
  return rpc<{ value: TokenLargestAccount[] }>("getTokenLargestAccounts", [mint]).then(
    (r) => r.value
  );
}

export function fetchSignaturesForAddress(address: string, limit = 100) {
  return rpc<SignatureInfo[]>("getSignaturesForAddress", [address, { limit }]);
}

export function fetchHeliusBalances(address: string) {
  return rpc<{ value: number }>("getBalance", [address]).then((r) => r.value);
}
