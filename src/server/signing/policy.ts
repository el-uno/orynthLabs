import { Transaction } from "@solana/web3.js";
import { runtimeEnv } from "@/lib/env";
import { getLauncherKeypair, getPoolCreatorKeypair } from "./signer";

/**
 * Solana packet limit. Anything larger cannot land on chain anyway, so we
 * reject it before spending work on deserialization or signing.
 */
export const MAX_TRANSACTION_BYTES = 1232;

export const MAX_INSTRUCTIONS = 16;

export type PolicyFailure = {
  ok: false;
  reason: string;
};

export type PolicyResult =
  | {
      ok: true;
      transaction: Transaction;
      requiredSigners: string[];
      programIds: string[];
    }
  | PolicyFailure;

function deny(reason: string): PolicyFailure {
  return { ok: false, reason };
}

/**
 * Validates a caller-supplied transaction before any authority key touches it.
 *
 * The rules are deliberately fail-closed: an unconfigured allowlist denies
 * everything rather than waving traffic through. See docs/SIGNING_BOUNDARY.md.
 */
export function evaluateSigningPolicy(serializedTransaction: string): PolicyResult {
  const allowedProgramIds = runtimeEnv.signingAllowedProgramIds;

  if (allowedProgramIds.length === 0) {
    return deny(
      "SIGNING_ALLOWED_PROGRAM_IDS is not configured; refusing to sign with an empty allowlist"
    );
  }

  let raw: Buffer;
  try {
    raw = Buffer.from(serializedTransaction, "base64");
  } catch {
    return deny("serializedTransaction is not valid base64");
  }

  if (raw.length === 0) {
    return deny("serializedTransaction decoded to zero bytes");
  }

  if (raw.length > MAX_TRANSACTION_BYTES) {
    return deny(
      `transaction is ${raw.length} bytes, above the ${MAX_TRANSACTION_BYTES} byte limit`
    );
  }

  let transaction: Transaction;
  try {
    transaction = Transaction.from(raw);
  } catch {
    return deny("serializedTransaction could not be deserialized as a legacy transaction");
  }

  if (!transaction.recentBlockhash) {
    return deny("transaction is missing a recent blockhash");
  }

  if (transaction.instructions.length === 0) {
    return deny("transaction contains no instructions");
  }

  if (transaction.instructions.length > MAX_INSTRUCTIONS) {
    return deny(
      `transaction has ${transaction.instructions.length} instructions, above the ${MAX_INSTRUCTIONS} limit`
    );
  }

  const programIds = transaction.instructions.map((instruction) =>
    instruction.programId.toBase58()
  );

  const disallowed = programIds.filter((programId) => !allowedProgramIds.includes(programId));
  if (disallowed.length > 0) {
    return deny(`transaction invokes non-allowlisted program(s): ${disallowed.join(", ")}`);
  }

  const poolCreator = getPoolCreatorKeypair().publicKey.toBase58();
  const launcher = getLauncherKeypair().publicKey.toBase58();

  const feePayer = (transaction.feePayer ?? transaction.signatures[0]?.publicKey)?.toBase58();
  if (feePayer !== launcher) {
    return deny("fee payer must be the launcher key");
  }

  const requiredSigners = transaction.signatures.map((signature) =>
    signature.publicKey.toBase58()
  );

  // Every signer we do not control must have already supplied a signature.
  // Otherwise the transaction can never land and we would be signing blind.
  const unknownUnsigned = transaction.signatures.filter((entry) => {
    const key = entry.publicKey.toBase58();
    const isOurs = key === poolCreator || key === launcher;
    return !isOurs && entry.signature === null;
  });

  if (unknownUnsigned.length > 0) {
    return deny(
      `transaction requires signatures we do not hold: ${unknownUnsigned
        .map((entry) => entry.publicKey.toBase58())
        .join(", ")}`
    );
  }

  if (!requiredSigners.includes(poolCreator) && !requiredSigners.includes(launcher)) {
    return deny("transaction does not require either backend authority as a signer");
  }

  return { ok: true, transaction, requiredSigners, programIds };
}
