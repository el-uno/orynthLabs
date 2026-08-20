# OrynthLabs

OrynthLabs (originally "Orynth Founder OS") is an operating-intelligence layer
for founders. It finds market gaps worth building into, understands the product
a founder is building, judges whether an onchain economy makes sense around it,
hands off to **Orynth** for the launch itself, and keeps monitoring the company
afterwards.

**Orynth is a separate company** — a launchpad for real, actively-built online
products. OrynthLabs integrates into it; `ORYNTH_API_KEY` and
`ORYNTH_API_BASE_URL` are external partner credentials.

**Full product context: [`docs/PRODUCT.md`](docs/PRODUCT.md)** — read it before
changing the domain model, scoring, or anything user-facing.

## The Loop

```
DISCOVER -> BUILD -> DESIGN -> LAUNCH -> GROW
   ^                                       |
   +---------- outcomes feed back ---------+
```

1. **Discover** — scan five signal families for gaps worth building into
2. **Build** — understand the founder's product as a Company Graph
3. **Design** — decide whether a token is warranted, and shape its economics
4. **Launch** — hand off to the Orynth Launch Engine
5. **Grow** — monitor product against market and surface divergences

A single signal is weak evidence. Strength comes from **intersections** across
families: builder activity *and* capital *and* consumer demand *and* inadequate
existing products. The scoring layer enforces exactly that.

This repo is intentionally scoped for a credible alpha, not the full
intelligence network.

## Recommended Stack

- Frontend: Next.js 15 + TypeScript
- UI: Tailwind CSS + shadcn/ui
- Backend: Next.js API routes now, with separate Node/NestJS workers where needed
- Database: PostgreSQL + Supabase
- Vector search: pgvector
- AI: OpenAI API
- Agent orchestration: lightweight custom workflows or LangGraph
- Wallet: Solana Wallet Adapter
- Orynth integration: Partner API
- RPC: Helius
- GitHub intelligence: GitHub API
- Social: X API/provider
- Market data: Birdeye or DexScreener + Solana RPC
- Jobs: Trigger.dev or BullMQ
- Cache: Redis
- Analytics: PostHog
- Hosting: Vercel + Railway, Fly, or AWS worker


## Project Structure

- `src/app` - App Router pages and API routes
- `src/components` - shared UI components
- `src/lib` - utilities, runtime config, and service clients
- `src/server` - backend-only code for ingestion, scoring, jobs, and integrations
- `workers` - optional separate worker processes as the build expands

## Current Alpha Slice

- `Overview` dashboard with metrics, tracked entities, and signal stream, read from Supabase
- `Pipeline`, `Signals`, and `Settings` routes
- Server-side integration adapters for Orynth, GitHub, and Helius
- `POST /api/launch-snapshot` queues snapshot composition from partner and GitHub data
- `POST /api/score-launch` queues scoring for the named repo
- `GET /api/jobs/{jobRecordId}` polls the outcome of either

The `POST` routes are asynchronous: they validate, enqueue, and return
`202` with a `jobRecordId`. They need `REDIS_URL` set and `npm run worker`
running, and return `503` otherwise rather than silently running inline.

Pages fall back to mock data when Supabase is unconfigured, and say so with a
badge in the UI, so the dashboard stays demoable without credentials.

## Database And Workers

- Supabase migrations live in `supabase/migrations`
- `launch_projects` stores opportunities and companies, with six-axis readiness
  and a tokenization recommendation (token fields are nullable)
- `signal_events` stores observed signals, tagged with an evidence family
- `launch_snapshots` stores API-composed snapshots
- `jobs` stores queue-visible job state for operational tracing
- `src/server/db` holds the repositories that read and write those tables
- `src/server/workers` holds the queue worker for ingestion and scoring
- `workers/index.ts` is the standalone worker entry point (`npm run worker`)

Migration `0002` enabled row level security on every table and originally made
`symbol` the unique upsert key — which migration `0007` replaced with `slug`,
because requiring a ticker excluded exactly the early-stage products this
system exists to assess. No RLS policies
are defined, so only the service role key can reach the data; add explicit
policies before pointing a browser-side Supabase client at any table.
Migration `0003` adds attempt tracking and a BullMQ job id to `jobs`, so a
failed row can be matched to the queue entry an operator needs to retry.

Jobs retry with exponential backoff — three attempts for launch ops, two for
signing. A job that is about to retry is recorded as `retrying`, not `failed`,
so the `jobs` table does not show red rows for work that is still in flight.

## API Auth

Every route that costs money or writes data requires a bearer token. Two
separate secrets, so holding the general token does not grant the ability to
queue work for the authority keys:

`API_TOKEN` guards `/api/score-launch`, `/api/launch-snapshot`,
`/api/ingest-github`, `/api/ingest-chain`, `/api/ingest-market` and
`/api/jobs/{id}`.

It fails closed — an unset secret returns `503` rather than accepting anonymous
callers. `/api/health` is intentionally open.

**This repo holds no signing keys.** Launches execute on the Orynth platform,
so no `poolCreator` or `launcher` authority belongs here. The signing subsystem
inherited from the original scaffold was removed on 2026-08-19.

## Readiness And Recommendations

Readiness is six axes — product, founder, market, community, distribution and
economic design — not a single number. An axis with no evidence scores `null`,
never 0: "unmeasured" and "measured and poor" are different claims.

The composite drives a recommendation, and the default answer is "not yet":

| Recommendation | When |
| --- | --- |
| `insufficient_evidence` | Fewer than 3 of 6 axes have any evidence |
| `do_not_tokenize` | A disqualifying signal, or a weak composite |
| `build_further` | Broad coverage, middling composite |
| `launch_now` | Composite >= 75 across at least 3 measured axes |

Advising a founder to tokenize on thin evidence is the costliest mistake this
system can make, so the thresholds are deliberately conservative.

## Chain Ingestion

`POST /api/ingest-chain` normalizes Solana activity for a token mint into
`signal_events`. Launches carry `token_mint` (migration 0006) — without it
there is no address to query.

Three signals per reading: transaction activity, holder concentration, and
supply. **Holder concentration carries a negative score delta** — a token whose
top 10 accounts hold most of the supply is a risk, and should pull a launch
score down no matter how active it looks.

Concentration is computed with `BigInt` over raw base units, not `uiAmount`
floats: a 9-decimal token with a 1e9 nominal supply has 1e18 base units, well
past 2^53 where float math silently loses precision.

**Set `HELIUS_API_KEY`.** Without it the client falls back to public mainnet
RPC, which throttles `getTokenLargestAccounts` hard, so the concentration
signal will not resolve. Rate-limit failures are not retried.

## Scheduler

The worker registers cron sweeps that fan out one job per tracked launch, so
newly added launches are picked up without touching the cron config.

| Variable | Default | Effect |
| --- | --- | --- |
| `SCHEDULER_ENABLED` | `false` | Master switch. Nothing is registered unless this is exactly `"true"`. |
| `SCHEDULER_INGEST_CRON` | `0 */6 * * *` | Ingestion sweep. |
| `SCHEDULER_SCORE_CRON` | *(unset)* | Scoring sweep. No default — scoring calls OpenAI per launch, so it is opt-in. |
| `SCHEDULER_TIMEZONE` | `UTC` | Cron timezone. |

Schedules reconcile on every worker boot: disabled ones are removed, not just
skipped, so turning the scheduler off does not leave a previous cron running.

**Set `GITHUB_TOKEN`.** Unauthenticated GitHub allows 60 requests/hour and each
ingestion costs 3, so a sweep over more than ~20 launches will exhaust it.
Rate-limit failures are not retried — the window resets hourly, so retrying
seconds later cannot succeed — and the recorded error carries the reset time.

## Testing

```bash
npm test
```

Covers the readiness and threshold layers, signal dedup, every ingestion
normalizer, the auth guard, job attempt accounting, and the dashboard's
mock-data fallback.

## Getting Started

1. Install dependencies
2. Copy `.env.example` to `.env.local`
3. Add required API keys and database settings
4. Apply the migrations in `supabase/migrations` (in order)
5. Run the app, and the worker process alongside it

```bash
npm install
npm run dev
```

The worker is a separate process; ingestion and scoring never run inside a
request:

```bash
npm run worker
```

## Alpha Goals

- Create a dashboard for launch monitoring
- Ingest GitHub, X, and market data
- Track on-chain signals for Solana launches
- Trigger backend workflows for scoring and alerts
- Keep all signing logic on the server side
