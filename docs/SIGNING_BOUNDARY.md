# Signing Boundary

This document exists because signing is the highest-risk part of the system.

## Rule

- `poolCreator` private key stays in backend/KMS/custody infrastructure
- `launcher` signs as payer
- frontend code must never import, log, or persist private signing material

## Why This Matters

If the signing boundary is blurred, the project becomes unsafe very quickly.

The alpha should prove the product logic without ever leaking authority into the browser.

## Approved Locations For Signing Logic

- `src/server/signing`
- worker processes
- backend job handlers

## Disallowed Locations For Signing Logic

- React components
- browser-local storage
- client-side API helpers
- public environment variables

## Enforced Controls

Key *location* is only half the problem. A backend-only key that will sign
anything is still a drained treasury. These controls govern key *usage*:

| Control | Where | Behaviour |
| --- | --- | --- |
| Bearer token auth | `src/server/signing/auth.ts` | `POST /api/enqueue-signing` requires `Authorization: Bearer $SIGNING_API_TOKEN`, compared in constant time. Unset token disables the route (503). |
| Program allowlist | `src/server/signing/policy.ts` | Every instruction's program ID must be in `SIGNING_ALLOWED_PROGRAM_IDS`. An empty allowlist denies everything. |
| Fee payer pin | `policy.ts` | The fee payer must be the launcher key. |
| Signer containment | `policy.ts` | Any required signer that is not ours must already have supplied a signature. |
| Size and shape limits | `policy.ts` | Max 1232 bytes, max 16 instructions, blockhash required, must actually require one of our authorities. |
| Double evaluation | route + worker | The worker re-runs the full policy; it does not trust the enqueuer. |
| Selective signing | `src/server/workers/signing-ops.ts` | Each authority signs only when the transaction actually requires it. |
| Payload hygiene | `src/server/db/jobs.ts` | The `jobs` table stores a summary (program IDs, signer list, instruction count), never the transaction blob. |

Run `npm run verify:signing` to exercise these rules against generated keypairs.

## Known Gap

The program allowlist does not yet constrain *instruction data* or destination
accounts. If a permissive program such as the System Program is allowlisted, a
transfer to an attacker-controlled address would still pass policy. Before
allowlisting any program that can move funds, add per-program instruction
decoding and a destination allowlist.

## Operational Pattern

1. A request or job creates a transaction or signing intent
2. The request is authenticated and the transaction is evaluated against policy
3. Backend code assembles or accepts the transaction
4. The worker re-evaluates policy, then the backend signer uses the correct authority
5. Launcher signs as payer where required
6. The signed artifact is submitted or returned through the backend

## Review Checklist

Before shipping any signing-related change, confirm:

- the private key is never exposed to the client
- the job is executed on a backend-only path
- the transaction is signed by the correct authority
- the code path is observable and testable

## Notes For New Engineers

If a change touches signing, treat it as security-sensitive work.
When in doubt, keep the responsibility in the backend and ask before moving it closer to the UI.
