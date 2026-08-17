import { createWorker } from "@/server/queue";
import { signAsBackendAuthority, signAsLauncherPayer } from "@/server/signing/signer";
import { Transaction } from "@solana/web3.js";

export function startSigningWorker() {
  return createWorker("signingOps", async (job) => {
    if (job.name !== "sign-transaction") {
      return { skipped: true };
    }

    const tx = Transaction.from(Buffer.from(job.data.serializedTransaction, "base64"));
    await signAsBackendAuthority(tx);
    await signAsLauncherPayer(tx);

    return {
      ok: true,
      signingBoundary: "poolCreator backend-only, launcher payer-signed"
    };
  });
}
