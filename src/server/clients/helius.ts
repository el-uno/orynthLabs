import { runtimeEnv } from "@/lib/env";

export async function fetchHeliusBalances(address: string) {
  const baseUrl = `https://mainnet.helius-rpc.com/?api-key=${runtimeEnv.heliusApiKey ?? ""}`;
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "orynth-productlab",
      method: "getBalance",
      params: [address]
    })
  });

  if (!response.ok) {
    throw new Error(`Helius request failed: ${response.status}`);
  }

  return response.json();
}
