import { createWorker } from "@/server/queue";
import { markJobStatus } from "@/server/db/jobs";
import { evaluateSigningPolicy } from "@/server/signing/policy";
import {
  getLauncherKeypair,
  getPoolCreatorKeypair,
  signAsBackendAuthority,
  signAsLauncherPayer
} from "@/server/signing/signer";
import { currentAttempt, isFinalAttempt } from "./job-attempts";

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
    const jobRecordId = job.data.jobRecordId;
    const attempt = currentAttempt(job);

    if (job.name !== "sign-transaction") {
      const reason = `unsupported job name: ${job.name}`;
      await markJobStatus(jobRecordId, "failed", { error: reason, attempts: attempt });
      return { ok: false, reason };
    }

    await markJobStatus(jobRecordId, "running", { attempts: attempt });

    try {
      // Re-run the policy here rather than trusting whoever enqueued the job.
      // The queue is a separate trust boundary from the API route.
      const policy = evaluateSigningPolicy(job.data.serializedTransaction);

      if (!policy.ok) {
        // A rejected transaction is not a transient fault. Return instead of
        // throwing so BullMQ does not retry a decision that cannot change.
        await markJobStatus(jobRecordId, "failed", {
          error: policy.reason,
          attempts: attempt
        });
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

      await markJobStatus(jobRecordId, "succeeded", { attempts: attempt });

      return { ok: true, signedTransaction, signedBy };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown signing error";

      await markJobStatus(jobRecordId, isFinalAttempt(job) ? "failed" : "retrying", {
        error: message,
        attempts: attempt
      });

      throw error;
    }
  });
}
