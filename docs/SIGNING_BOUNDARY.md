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

## Operational Pattern

1. A request or job creates a transaction or signing intent
2. Backend code assembles the transaction
3. Backend signer uses the correct authority
4. Launcher signs as payer where required
5. The signed artifact is submitted or returned through the backend

## Review Checklist

Before shipping any signing-related change, confirm:

- the private key is never exposed to the client
- the job is executed on a backend-only path
- the transaction is signed by the correct authority
- the code path is observable and testable

## Notes For New Engineers

If a change touches signing, treat it as security-sensitive work.
When in doubt, keep the responsibility in the backend and ask before moving it closer to the UI.
