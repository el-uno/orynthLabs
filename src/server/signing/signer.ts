import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { runtimeEnv } from "@/lib/env";

function parseKeypairSecret(secret: string) {
  const values = JSON.parse(secret) as number[];
  return Uint8Array.from(values);
}

export function getPoolCreatorKeypair() {
  if (!runtimeEnv.poolCreatorSignerKey) {
    throw new Error("POOL_CREATOR_SIGNER_KEY is not configured");
  }

  return Keypair.fromSecretKey(parseKeypairSecret(runtimeEnv.poolCreatorSignerKey));
}

export function getLauncherKeypair() {
  if (!runtimeEnv.launcherSignerKey) {
    throw new Error("LAUNCHER_SIGNER_KEY is not configured");
  }

  return Keypair.fromSecretKey(parseKeypairSecret(runtimeEnv.launcherSignerKey));
}

export async function signAsBackendAuthority(transaction: Transaction) {
  const poolCreator = getPoolCreatorKeypair();
  transaction.partialSign(poolCreator);
  return transaction;
}

export async function signAsLauncherPayer(transaction: Transaction) {
  const launcher = getLauncherKeypair();
  transaction.partialSign(launcher);
  return transaction;
}

export function assertSigningBoundary() {
  const poolCreator = getPoolCreatorKeypair().publicKey.toBase58();
  const launcher = getLauncherKeypair().publicKey.toBase58();

  return {
    poolCreator,
    launcher,
    boundary: "poolCreator stays server-side, launcher signs as payer"
  };
}

export function isPublicKey(value: string) {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}
