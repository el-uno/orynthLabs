import { runtimeEnv } from "@/lib/env";

export async function fetchOrynthPartnerData(path: string) {
  const baseUrl = runtimeEnv.orynthApiBaseUrl;
  const response = await fetch(`${baseUrl}${path}`, {
    headers: runtimeEnv.orynthApiKey
      ? { Authorization: `Bearer ${runtimeEnv.orynthApiKey}` }
      : undefined
  });

  if (!response.ok) {
    throw new Error(`Orynth request failed: ${response.status}`);
  }

  return response.json();
}
