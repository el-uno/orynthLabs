import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import { evaluateSigningPolicy } from "./policy";

const poolCreator = Keypair.generate();
const launcher = Keypair.generate();
const outsider = Keypair.generate();

const ALLOWED = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const DENIED = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const BLOCKHASH = "11111111111111111111111111111111";

function build(options: { programId: string; feePayer: PublicKey; signers: PublicKey[] }) {
  const tx = new Transaction();
  tx.recentBlockhash = BLOCKHASH;
  tx.feePayer = options.feePayer;
  tx.add(
    new TransactionInstruction({
      keys: options.signers.map((pubkey) => ({ pubkey, isSigner: true, isWritable: false })),
      programId: new PublicKey(options.programId),
      data: Buffer.alloc(0)
    })
  );
  return tx
    .serialize({ requireAllSignatures: false, verifySignatures: false })
    .toString("base64");
}

function validTransaction() {
  return build({
    programId: ALLOWED,
    feePayer: launcher.publicKey,
    signers: [launcher.publicKey, poolCreator.publicKey]
  });
}

describe("evaluateSigningPolicy", () => {
  beforeEach(() => {
    process.env.POOL_CREATOR_SIGNER_KEY = JSON.stringify(Array.from(poolCreator.secretKey));
    process.env.LAUNCHER_SIGNER_KEY = JSON.stringify(Array.from(launcher.secretKey));
    process.env.SIGNING_ALLOWED_PROGRAM_IDS = ALLOWED;
  });

  afterEach(() => {
    delete process.env.POOL_CREATOR_SIGNER_KEY;
    delete process.env.LAUNCHER_SIGNER_KEY;
    delete process.env.SIGNING_ALLOWED_PROGRAM_IDS;
  });

  it("accepts an allowlisted program paid for by the launcher", () => {
    const result = evaluateSigningPolicy(validTransaction());
    expect(result.ok).toBe(true);
  });

  it("rejects a program that is not on the allowlist", () => {
    const result = evaluateSigningPolicy(
      build({
        programId: DENIED,
        feePayer: launcher.publicKey,
        signers: [launcher.publicKey, poolCreator.publicKey]
      })
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("non-allowlisted program");
  });

  it("rejects a fee payer other than the launcher", () => {
    const result = evaluateSigningPolicy(
      build({
        programId: ALLOWED,
        feePayer: outsider.publicKey,
        signers: [outsider.publicKey, poolCreator.publicKey]
      })
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("fee payer must be the launcher");
  });

  it("rejects a transaction requiring a signature we do not hold", () => {
    const result = evaluateSigningPolicy(
      build({
        programId: ALLOWED,
        feePayer: launcher.publicKey,
        signers: [launcher.publicKey, outsider.publicKey]
      })
    );

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("signatures we do not hold");
  });

  it("rejects a malformed payload", () => {
    const result = evaluateSigningPolicy("not-a-transaction!!!");
    expect(result.ok).toBe(false);
  });

  it("rejects an oversized payload", () => {
    const result = evaluateSigningPolicy(Buffer.alloc(2000).toString("base64"));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("byte limit");
  });

  it("fails closed when the allowlist is empty", () => {
    process.env.SIGNING_ALLOWED_PROGRAM_IDS = "";
    const result = evaluateSigningPolicy(validTransaction());

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("empty allowlist");
  });

  it("fails closed when the allowlist variable is absent entirely", () => {
    delete process.env.SIGNING_ALLOWED_PROGRAM_IDS;
    const result = evaluateSigningPolicy(validTransaction());
    expect(result.ok).toBe(false);
  });
});
