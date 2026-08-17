# Orynth Labs

Orynth Lab is the alpha workspace for a focused 4-week technical build around launch intelligence, chain activity, social signals, and product execution workflows.

This repo is intentionally scoped for a credible alpha, not the full intelligence network.

## Recommended Stack

- Frontend: Next.js 16 + TypeScript
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

- `Overview` dashboard with metrics, launch queue, and signal stream
- `Launches`, `Signals`, and `Settings` routes
- Server-side integration adapters for Orynth, GitHub, and Helius
- `POST /api/launch-snapshot` to compose a launch snapshot from partner and GitHub data
- Explicit signing boundary documentation under `src/server/signing`

## Database And Workers

- Supabase migrations live in `supabase/migrations`
- `launch_projects` stores launch records and scoring state
- `signal_events` stores normalized cross-source signals
- `launch_snapshots` stores API-composed snapshots
- `jobs` stores queue-visible job state for operational tracing
- `src/server/workers` holds queue workers for scoring and signing

## Getting Started

1. Install dependencies
2. Copy `.env.example` to `.env.local`
3. Add required API keys and database settings
4. Run the app in development

```bash
npm install
npm run dev
```

## Alpha Goals

- Create a dashboard for launch monitoring
- Ingest GitHub, X, and market data
- Track on-chain signals for Solana launches
- Trigger backend workflows for scoring and alerts
- Keep all signing logic on the server side
