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
| 1. Discover | ~35% — ingestion for 4 of 5 families; nothing generates Build Opportunities |
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

**The binding constraint:** four families have ingestion; `attention` does not,
and is blocked on X API credits rather than on code. Two of six readiness axes
remain unmeasurable — `community`, which only attention can reach, and
`economicDesign`, which needs the Economic Design Studio (E2).

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
*Blocked on X API **credits**, not a token. The bearer token is valid and
configured; every v2 read endpoint returns `402 credits depleted`, including
the cheapest single-tweet fetch. Reddit may be the cheaper first source.*

**Highest leverage single change.** Unlocks `community` and `distribution`,
taking measurable axes from 3 to 5 of 6. Until this exists, no entity can be
assessed as launch-ready no matter how good it is.

Follow the proven shape: pure normalizer + thin IO wrapper + job type + route +
fan-out entry. Signals must carry `family: "attention"`.

*Watch for:* rate limits far tighter than GitHub's; reuse the fail-fast pattern.

### A2. Consumer ingestion — user voice ✅ *shipped 2026-08-19*
GitHub issues, using the existing token. Same API as the builder family,
different evidence: commits are what the team does, issues are what users
experience. Three signals — user-reported demand, maintainer responsiveness,
issue composition. `distribution` moved from `null` to 53 and `product` from
59 to 62; measurable axes went from 3 to 4 of 6.

Remaining in this family: app rankings, search behaviour and reviews have no
source yet, and all are paid.

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

### B1. Opportunity synthesis ✅ *shipped 2026-08-19*
An opportunity is registered as an entity with a `market_topic`
(`POST /api/opportunities`), so the existing ingestion sweep gathers evidence
against it with no new plumbing, and the same scoring job assesses it.
`scoring/opportunity.ts` requires **an observed gap AND demand across two or
more families** before calling anything an opportunity; `GET /api/opportunities`
is the Marketplace read. Migration 0010 adds the verdict.

Three pre-existing bugs surfaced while verifying it:
- `sweep-scoring` fanned out over repositories only, so opportunities were
  ingested but never assessed
- scoring read `signal_events` globally, so three companies scored identically
  and an opportunity borrowed another entity's demand to claim an intersection
- entities with no signals were scored on **mock fixtures**, fabricating a 70

*Remaining:* nothing proposes candidate topics yet — they are registered by
hand. Topic discovery is the next step toward a self-feeding Marketplace.

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

## Correctness fixes

### Derived score ✅ *done 2026-08-19*
The top-line score was circular. With no model configured, scoring read
`launch_projects.score` off the row, used it to gate the status
(`score >= 75` => ready), then wrote the same number back — so a seeded 92
made an entity "ready" with no evidence behind it. Structurally the same fault
as scoring consuming its own output from `signal_events`, travelling through a
different column.

The score is now the readiness composite. The model contributes the rationale
only; its `score` field is parsed for conformance and discarded. Where no axis
is measurable there is no score, so the column is nullable (migration 0009) —
`0` would read as "assessed and poor" rather than "not assessed".

Verified: a stored score of 100 and of 1 now produce identical output, and
Atlas moved from its seeded 92 to a derived 65.

---

### Market-structure calibration ✅ *done 2026-08-19*
Swept 16 live topics across an expected spectrum. The coverage measure
discriminates where it matters — saturated markets averaged 10.8 incumbents
against 1.8 for niche — but three faults showed up:

- **Concentration punished sparse markets.** At two incumbents one almost
  always holds >70% of downloads, so the "category has an owner" penalty fired
  on open fields. `mcp server framework` had two incumbents and a net *negative*
  gap. Floor raised to 4; that topic now reads +4.
- **The count was censored but presented as exact.** `MAX_DOWNLOAD_LOOKUPS`
  caps candidates examined, so busy markets peg at the cap — saturated and
  mid-tier were indistinguishable (10.8 vs 10.3). Capped counts now report as
  `12+ incumbents`, "at least N".
- **Relevance leaked on long topics.** A flat 50% let a four-word topic qualify
  on two words; `multi agent treasury coordination` returned six generic
  "incumbents". Required overlap now scales with topic length, and that topic
  now returns two.

**Deliberately not tuned:** `STRONG_MIN_SCORE` and `MIN_DEMAND_FAMILIES`. Every
topic returned `crowded` or `insufficient_evidence` — not because the gates are
wrong but because opportunities carry only market-structure evidence, so the
paths those constants govern are unreachable. Tuning them now would be fitting
to a path nothing can take. Topic-scoped demand ingestion is the prerequisite.

**Operational constraint:** npm's download API rate-limited after roughly three
topics and needed ~90 seconds to clear, capping a sweep near 20 topics/hour.
Topic discovery will need queueing and pacing, not a burst.

---

## Gates — not phases, but blocking

| Gate | Before |
| --- | --- |
| **App-level auth** | Any hosting. API routes are token-guarded; the dashboard pages are fully public |
| **`GITHUB_TOKEN` in the worker env** | Enabling the scheduler on a real list. 60 req/hour unauthenticated, 3 per ingestion |
| **Threshold calibration** | *Market-structure constants calibrated 2026-08-19 against 16 live topics (see Correctness fixes). Readiness and opportunity thresholds remain uncalibrated* |
| **`OPENAI_API_KEY`** | Expecting useful rationales or semantic dedup. Scores and statuses are deterministic and unaffected, but rationales are placeholder text and embeddings are null |

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
