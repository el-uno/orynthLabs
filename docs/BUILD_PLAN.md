# OrynthLabs Build Plan

Forward plan from the current state. Read [`PRODUCT.md`](PRODUCT.md) first — it
defines what the product is; this defines what to build next and in what order.

Last revised: 2026-08-19

---

## Where we are

An **assessment engine**, not yet a Founder OS. It can judge a company you
point it at. It cannot yet tell you what to build, understand your product, or
tell you what to do next.

| Stage | State |
| --- | --- |
| 1. Discover | ~25% — ingestion for 3 of 5 families; nothing generates Build Opportunities |
| 2. Build | ~5% — schema holds a company; no Company Graph ingestion |
| 3. Design | ~40% — six-axis readiness and recommendation enforced; no Economic Design Studio |
| 4. Launch | 0% — no Orynth handoff |
| 5. Grow | ~10% — score history and trend; no divergence detection |
| Feedback loop | 0% — nothing records which opportunities became good companies |

**Built and load-bearing:** idempotent ingestion across three families, a cron
scheduler that cannot inflate the signal table, deterministic scoring that
overrides the model, two-pass dedup, job tracing, and bearer auth on every
route that costs money. 139 tests, 8 migrations, verified against live GitHub,
npm, Solana RPC and Supabase.

**The binding constraint:** `builder`, `capital` and `market_structure` have
ingestion; `attention` and `consumer` do not. Three of six readiness axes
remain unmeasurable, so the ceiling is still set by ingestion coverage rather
than scoring logic — A1 is what lifts it.

---

## Ordering principle

Work is ordered by **what unblocks the most downstream capability**, not by
effort. Two dependencies drive everything below:

1. **Discover depends on breadth.** Market gaps are found at *intersections* —
   "attention high, capital flowing, existing products inadequate". That
   sentence cannot be evaluated with GitHub and an RPC endpoint. Broad
   ingestion is a prerequisite for the Idea Marketplace, not a parallel track.
2. **The moat depends on elapsed time.** The feedback loop needs outcomes
   observed over months. Instrumenting it is cheap and starts the clock, so it
   comes far earlier than its immediate value suggests.

---

## Phase A — Raise the ceiling (ingestion breadth)

*Unblocks: three readiness axes, and Discover entirely.*

### A1. Attention ingestion — X, then Reddit
**Highest leverage single change.** Unlocks `community` and `distribution`,
taking measurable axes from 3 to 5 of 6. Until this exists, no entity can be
assessed as launch-ready no matter how good it is.

Follow the proven shape: pure normalizer + thin IO wrapper + job type + route +
fan-out entry. Signals must carry `family: "attention"`.

*Blocked on:* `X_API_BEARER_TOKEN`.
*Watch for:* rate limits far tighter than GitHub's; reuse the fail-fast pattern.

### A2. Consumer ingestion — product adoption and usage
Strengthens `product` and `distribution` with demand-side evidence rather than
build-side proxies. App rankings, search behaviour, reviews, complaints.

*Blocked on:* source selection — this is the least obvious family to source.

### A3. Market-structure ingestion — competitors and gaps ✅ *shipped 2026-08-19*
npm registry (public, no credentials) measuring existing solution coverage,
incumbent staleness and adoption concentration against an entity's
`market_topic` (migration 0008). `market` readiness rose from 74 to 86 on live
data.

Remaining in this family: pricing gaps, UX quality and regulatory change have
no source yet.

### A4. Orynth partner adapter
*Blocked on:* real base URL (still `api.orynth.example`) and a **sample
response body** — the response shape defines the normalizer, and the key alone
unblocks nothing.

---

## Phase B — The entry point (Idea Marketplace)

*Depends on Phase A. Without it the loop has no beginning and no moat.*

### B1. Opportunity synthesis
Detect intersections across families and emit `entity_kind: "opportunity"`
rows. The schema already holds them; nothing creates them. The existing
threshold layer's family-corroboration logic is the right primitive to build on.

### B2. Opportunity scoring and presentation
Opportunity score, "why now", signals behind it, observed gap, possible
products, potential users, monetization paths, Orynth economic fit — the
structured shape defined in `PRODUCT.md`.

### B3. Feedback instrumentation
Record which opportunities were claimed, by whom, and what happened. **Start
this with B1 even though it returns nothing for months** — the moat is
longitudinal, and data not captured now cannot be recovered later.

---

## Phase C — Understand the company (stage 2)

### C1. Company Graph ingestion
Website, product docs, socials, analytics, users, revenue. Turns a tracked row
into a company we actually understand.

### C2. Founder signal
`founder` readiness is currently inferred from commit activity alone, which is
a weak proxy. Needs real founder-level evidence.

---

## Phase D — Post-launch value (stage 5)

### D1. Divergence detection
The actual product value of stage 5: "product adoption +42% while attention
−18%" (under-discovered) or "token volume +310% while usage −12% and dev
activity −34%" (market ahead of fundamentals). Requires score history across
families over time — history already accumulates, so this becomes possible
without new ingestion.

### D2. Recommendation engine
Turn divergences into "what the founder should do next".

---

## Phase E — The launch path (stage 4)

### E1. Retire the signing surface ✅ *done 2026-08-19*
Launches run on the Orynth platform, so OrynthLabs holds no launch authority.
The `poolCreator` / `launcher` keys were scaffold residue from a wrong
assumption about who runs the launch.

Removed: `src/server/signing/`, `src/server/workers/signing-ops.ts`, the
`signing-ops` queue, `POST /api/enqueue-signing`, `docs/SIGNING_BOUNDARY.md`,
the `SIGNING_*` and `*_SIGNER_KEY` env vars, and `@solana/web3.js` — which
nothing else used, since the Helius client speaks raw JSON-RPC.

This deleted the repo's highest-risk surface outright and closed the
instruction-level validation gate by removing what it guarded, rather than by
building more validation.

### E2. Economic Design Studio
Token purpose, founder economics, treasury, incentives, utility, fee strategy.
Until this exists `economicDesign` scores `null` permanently, capping every
composite.

### E3. Orynth Launch Engine handoff

---

## Gates — not phases, but blocking

| Gate | Before |
| --- | --- |
| **App-level auth** | Any hosting. API routes are token-guarded; the dashboard pages are fully public |
| **`GITHUB_TOKEN` in the worker env** | Enabling the scheduler on a real list. 60 req/hour unauthenticated, 3 per ingestion |
| **Threshold calibration** | Trusting any recommendation. Constants were set against one seeded row and one real repo |

---

## Deferred

- Multi-tenant / team workflows
- Broad multi-chain coverage
- Consumer-grade UX polish
- Any custody or signing role, unless Orynth later says partners co-sign
- PostHog, structured logs, alerting — valuable, but after the product does something worth observing

---

## Non-negotiable constraints

- No signing keys in this repo at all — launches are Orynth's to execute
- Scoring output never re-enters `signal_events`
- Ingestion is idempotent, keyed on `(source, external_id)`
- Corroboration is measured across evidence **families**, never across APIs
- An unmeasured readiness axis is `null`, never `0`
- "Do not tokenize yet" remains a first-class outcome
- Anything that enqueues work goes through the queue factories, or it silently
  loses the retry policy
