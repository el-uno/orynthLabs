import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";

const poolCreator = Keypair.generate();
const launcher = Keypair.generate();
const outsider = Keypair.generate();

const ALLOWED = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const DENIED = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

process.env.POOL_CREATOR_SIGNER_KEY = JSON.stringify(Array.from(poolCreator.secretKey));
process.env.LAUNCHER_SIGNER_KEY = JSON.stringify(Array.from(launcher.secretKey));
process.env.SIGNING_API_TOKEN = "test-token";
process.env.SIGNING_ALLOWED_PROGRAM_IDS = ALLOWED;

const { evaluateSigningPolicy } = await import("../src/server/signing/policy");
const { authorizeSigningRequest } = await import("../src/server/signing/auth");

const BLOCKHASH = "11111111111111111111111111111111";

function build(options: {
  programId: string;
  feePayer: PublicKey;
  signers: PublicKey[];
}) {
  const tx = new Transaction();
  tx.recentBlockhash = BLOCKHASH;
  tx.feePayer = options.feePayer;
  tx.add(
    new TransactionInstruction({
      keys: options.signers.map((pubkey) => ({
        pubkey,
        isSigner: true,
        isWritable: false
      })),
      programId: new PublicKey(options.programId),
      data: Buffer.alloc(0)
    })
  );
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
}

const results: string[] = [];
function check(name: string, actual: boolean, expected: boolean, detail = "") {
  const pass = actual === expected;
  results.push(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// 1. Happy path: allowlisted program, launcher pays, poolCreator required.
const good = build({
  programId: ALLOWED,
  feePayer: launcher.publicKey,
  signers: [launcher.publicKey, poolCreator.publicKey]
});
const r1 = evaluateSigningPolicy(good);
check("allowlisted program + launcher fee payer is accepted", r1.ok, true, r1.ok ? "" : r1.reason);

// 2. Non-allowlisted program.
const r2 = evaluateSigningPolicy(
  build({
    programId: DENIED,
    feePayer: launcher.publicKey,
    signers: [launcher.publicKey, poolCreator.publicKey]
  })
);
check("non-allowlisted program is rejected", r2.ok, false, r2.ok ? "" : r2.reason);

// 3. Fee payer is not the launcher.
const r3 = evaluateSigningPolicy(
  build({
    programId: ALLOWED,
    feePayer: outsider.publicKey,
    signers: [outsider.publicKey, poolCreator.publicKey]
  })
);
check("foreign fee payer is rejected", r3.ok, false, r3.ok ? "" : r3.reason);

// 4. Requires a signature from a key we do not hold.
const r4 = evaluateSigningPolicy(
  build({
    programId: ALLOWED,
    feePayer: launcher.publicKey,
    signers: [launcher.publicKey, outsider.publicKey]
  })
);
check("unheld required signer is rejected", r4.ok, false, r4.ok ? "" : r4.reason);

// 5. Garbage input.
const r5 = evaluateSigningPolicy("not-a-transaction!!!");
check("malformed payload is rejected", r5.ok, false, r5.ok ? "" : r5.reason);

// 6. Oversized payload.
const r6 = evaluateSigningPolicy(Buffer.alloc(2000).toString("base64"));
check("oversized payload is rejected", r6.ok, false, r6.ok ? "" : r6.reason);

// 7. Empty allowlist must fail closed.
process.env.SIGNING_ALLOWED_PROGRAM_IDS = "";
const { runtimeEnv } = await import("../src/lib/env");
(runtimeEnv as { signingAllowedProgramIds: string[] }).signingAllowedProgramIds = [];
const r7 = evaluateSigningPolicy(good);
check("empty allowlist denies everything", r7.ok, false, r7.ok ? "" : r7.reason);
(runtimeEnv as { signingAllowedProgramIds: string[] }).signingAllowedProgramIds = [ALLOWED];

// 8-10. Auth behaviour.
const noHeader = authorizeSigningRequest(new Request("http://x/api"));
check("missing bearer token is rejected", noHeader.ok, false);

const badToken = authorizeSigningRequest(
  new Request("http://x/api", { headers: { authorization: "Bearer wrong" } })
);
check("wrong bearer token is rejected", badToken.ok, false);

const goodToken = authorizeSigningRequest(
  new Request("http://x/api", { headers: { authorization: "Bearer test-token" } })
);
check("correct bearer token is accepted", goodToken.ok, true);

console.log(results.join("\n"));
console.log(results.some((line) => line.startsWith("FAIL")) ? "\nSOME CHECKS FAILED" : "\nALL CHECKS PASSED");
