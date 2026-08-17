import { createWorker } from "@/server/queue";
import { markJobStatus } from "@/server/db/jobs";
import { evaluateSigningPolicy } from "@/server/signing/policy";
import {
  getLauncherKeypair,
  getPoolCreatorKeypair,
  signAsBackendAuthority,
  signAsLauncherPayer
} from "@/server/signing/signer";

export type SigningJobData = {
  serializedTransaction: string;
  jobRecordId?: string | null;
};

export type SigningJobResult = {
  ok: boolean;
  signedTransaction?: string;
  signedBy?: string[];
  reason?: string;
};

export function startSigningWorker() {
  return createWorker<SigningJobData, SigningJobResult>("signingOps", async (job) => {
    if (job.name !== "sign-transaction") {
      return { ok: false, reason: `unsupported job name: ${job.name}` };
    }

    const jobRecordId = job.data.jobRecordId;
    await markJobStatus(jobRecordId, "running");

    try {
      // Re-run the policy here rather than trusting whoever enqueued the job.
      // The queue is a separate trust boundary from the API route.
      const policy = evaluateSigningPolicy(job.data.serializedTransaction);

      if (!policy.ok) {
        await markJobStatus(jobRecordId, "failed", policy.reason);
        return { ok: false, reason: policy.reason };
      }

      const { transaction, requiredSigners } = policy;
      const poolCreator = getPoolCreatorKeypair().publicKey.toBase58();
      const launcher = getLauncherKeypair().publicKey.toBase58();
      const signedBy: string[] = [];

      // Only apply an authority the transaction actually asks for.
      if (requiredSigners.includes(poolCreator)) {
        await signAsBackendAuthority(transaction);
        signedBy.push("poolCreator");
      }

      if (requiredSigners.includes(launcher)) {
        await signAsLauncherPayer(transaction);
        signedBy.push("launcher");
      }

      const signedTransaction = transaction
        .serialize({ requireAllSignatures: false })
        .toString("base64");

      await markJobStatus(jobRecordId, "succeeded");

      return { ok: true, signedTransaction, signedBy };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown signing error";
      await markJobStatus(jobRecordId, "failed", message);
      throw error;
    }
  });
}
