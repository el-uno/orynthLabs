# Orynth Labs

Orynth Lab is the alpha workspace for a focused 4-week technical build around launch intelligence, chain activity, social signals, and product execution workflows.

This repo is intentionally scoped for a credible alpha, not the full intelligence network.

## Recommended Stack

- Frontend: Next.js 15 + TypeScript
- UI: Tailwind CSS + shadcn/ui
- Backend: Next.js API routes now, with separate Node/NestJS workers where needed
- Database: PostgreSQL + Supabase
- Vector search: pgvector
- AI: OpenAI API
- Agent orchestration: lightweight custom workflows or LangGraph
- Blockchain: Solana web3.js
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
- Secrets/signing: KMS or custody signer for production


## Project Structure

- `src/app` - App Router pages and API routes
- `src/components` - shared UI components
- `src/lib` - utilities, runtime config, and service clients
- `src/server` - backend-only code for signing, jobs, and integrations
- `workers` - optional separate worker processes as the build expands

## Current Alpha Slice

- `Overview` dashboard with metrics, launch queue, and signal stream, read from Supabase
- `Launches`, `Signals`, and `Settings` routes
- Server-side integration adapters for Orynth, GitHub, and Helius
- `POST /api/launch-snapshot` queues snapshot composition from partner and GitHub data
- `POST /api/score-launch` queues scoring for the named repo
- `GET /api/jobs/{jobRecordId}` polls the outcome of either
- `POST /api/enqueue-signing` is authenticated and policy-gated (see below)
- Enforced signing boundary under `src/server/signing`

The three `POST` routes are asynchronous: they validate, enqueue, and return
`202` with a `jobRecordId`. They need `REDIS_URL` set and `npm run worker`
running, and return `503` otherwise rather than silently running inline.

Pages fall back to mock data when Supabase is unconfigured, and say so with a
badge in the UI, so the dashboard stays demoable without credentials.

## Database And Workers

- Supabase migrations live in `supabase/migrations`
- `launch_projects` stores launch records and scoring state
- `signal_events` stores normalized cross-source signals
- `launch_snapshots` stores API-composed snapshots
- `jobs` stores queue-visible job state for operational tracing
- `src/server/db` holds the repositories that read and write those tables
- `src/server/workers` holds queue workers for scoring and signing
- `workers/index.ts` is the standalone worker entry point (`npm run worker`)

Migration `0002` adds a unique index on `launch_projects.symbol` (the upsert
conflict target) and enables row level security on every table. No RLS policies
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

| Secret | Guards |
| --- | --- |
| `API_TOKEN` | `/api/score-launch`, `/api/launch-snapshot`, `/api/jobs/{id}` |
| `SIGNING_API_TOKEN` | `/api/enqueue-signing` |

Both fail closed — an unset secret returns `503` rather than accepting
anonymous callers. `/api/health` is intentionally open.

## Testing

```bash
npm test
```

Covers the signing policy, both auth guards, the deterministic scoring
fallback, job attempt accounting, and the dashboard's mock-data fallback.
`npm run verify:signing` runs just the security-critical subset.

## Signing Safety

`POST /api/enqueue-signing` is the highest-risk surface in the repo. It requires
a bearer token and rejects any transaction that fails policy — non-allowlisted
programs, a fee payer other than the launcher, unknown required signers, or
oversized payloads. Both env vars below fail closed: unset means "refuse", not
"allow".

```
SIGNING_API_TOKEN=<shared secret>
SIGNING_ALLOWED_PROGRAM_IDS=<comma-separated base58 program IDs>
```

Verify the rules with:

```bash
npm run verify:signing
```

See `docs/SIGNING_BOUNDARY.md` for the full control list and the known gap
around instruction-level validation.

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

The worker is a separate process and is the only runtime that needs the signing
keys:

```bash
npm run worker
```

## Alpha Goals

- Create a dashboard for launch monitoring
- Ingest GitHub, X, and market data
- Track on-chain signals for Solana launches
- Trigger backend workflows for scoring and alerts
- Keep all signing logic on the server side
