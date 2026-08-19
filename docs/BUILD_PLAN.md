# OrynthLabs Build Plan

## Purpose

This plan describes how the product moves from idea to a credible alpha and then toward a more durable platform.

The aim is not to build the entire intelligence network in one pass. The goal is a narrow, usable system that proves the core workflow:

1. ingest signals
2. score launch opportunities
3. protect secrets and signing
4. surface the highest-value actions

## Product Vision

OrynthLabs is a Founder OS: Discover -> Build -> Design -> Launch -> Grow.

It identifies market gaps worth building into, understands a founder's product,
judges whether an onchain economy makes sense around it, hands the launch to
**Orynth** (a separate company's launchpad), and monitors the company after.

Crucially, "do not tokenize yet" is a valid and expected outcome. A token
should amplify a product's economy, not replace it.

## What The Alpha Must Prove

The alpha is successful if it can:

- track opportunities and companies, most of which have no token
- ingest and normalize signals from multiple sources
- score projects in a reproducible way
- show multi-axis launch readiness, including when NOT to launch
- keep signing and authority actions strictly server-side
- expose enough operational visibility for engineers to trust the system

## Out Of Scope For Alpha

The following are intentionally deferred:

- a full multi-tenant intelligence platform
- generalized agent marketplace behavior
- complex governance or approval flows
- broad protocol coverage across every chain
- highly polished consumer-grade UX
- production-grade custody rollout unless required for a specific workflow

## Build Phases

### Phase 0: Foundation

Status: complete in scaffold form

Deliverables:

- Next.js app scaffold
- Tailwind-ready UI system
- route handlers for health and workflow entry points
- repo docs and environment template
- clear signing boundary documentation

### Phase 1: Data Model And Infrastructure

Goal: establish the persistent model for launches, signals, snapshots, and jobs.

Deliverables:

- Supabase/Postgres schema
- seed data for initial launch candidates
- migrations for launch projects, signal events, snapshots, and job records
- indexes for status, score, and recency

Why this comes early:

- all downstream features depend on a stable schema
- scoring, UI, and workers need shared source-of-truth records

### Phase 2: Signal Ingestion

Goal: pull in the first useful sources and normalize them.

Deliverables:

- GitHub ingestion for repository activity
- Orynth partner API adapter
- X signal adapter
- market-data adapter for Solana launch context
- Helius-based chain lookups

Expected outputs:

- normalized signal objects
- stored signal history
- source metadata and provenance

### Phase 3: Scoring And Extraction

Goal: turn raw signals into launch assessments.

Deliverables:

- OpenAI scoring pipeline
- schema-validated structured outputs
- deterministic fallback when AI credentials are missing
- launch status transitions based on score thresholds

Expected behavior:

- low signal density leads to draft or watching
- meaningful signal clusters raise readiness
- scoring outputs remain explainable

### Phase 4: Worker System

Goal: move non-request work out of the web process.

Deliverables:

- Redis-backed queue
- BullMQ workers
- scoring jobs
- signing jobs
- job persistence for visibility

Why this matters:

- prevents route handlers from becoming long-running orchestration code
- makes retries and operational tracing easier

### Phase 5: Server-Side Signing

Goal: enforce the custody boundary.

Deliverables:

- backend-only signer module
- `poolCreator` key stored outside the frontend
- launcher payer signing flow
- transaction assembly and submission pattern

Security requirement:

- the frontend must never hold or see `poolCreator` private material

### Phase 6: Product UX

Goal: make the alpha useful for humans, not just machines.

Deliverables:

- dashboard overview
- launch queue and signal stream
- per-project detail views
- status transitions and notes
- operational feedback about scoring and signing

### Phase 7: Observability And Hardening

Goal: prepare the alpha for real usage.

Deliverables:

- PostHog analytics
- structured logs
- error handling and alerting
- rate-limit aware external integrations
- audit-friendly job history

## Current Milestone Map

### Milestone 1

Status: in progress

- dashboard shell
- launch queue and signal stream
- server workflow adapters
- database schema scaffold
- scoring and worker skeletons

### Milestone 2

Planned:

- connect live Supabase client usage
- implement first real ingestion jobs
- persist scores and signals
- expose project detail pages

### Milestone 3

Planned:

- add signing job execution against a real Solana transaction flow
- wire in production secret storage
- add operational logs and analytics

## Functional Roadmap

### Week 1

- lock the schema
- wire env handling
- confirm route handlers and mock data
- set up worker process entry points

### Week 2

- ingest GitHub and Orynth partner data
- normalize signals into the database
- score launches with typed AI outputs

### Week 3

- add signing workflow
- connect queue consumers
- add retries and job status persistence

### Week 4

- improve dashboard detail views
- add analytics
- harden error handling
- prepare alpha release notes

## Acceptance Criteria For Alpha

The alpha is ready when:

- engineers can understand the entire system from these docs
- the dashboard shows meaningful launch and signal state
- the scoring pipeline can produce stable output
- background jobs can be queued and processed
- signing remains server-side only
- the project can be extended without rewriting the core model

## Finished Product Direction

If the alpha proves useful, the longer-term product can evolve into:

- a richer launch intelligence graph
- automated monitoring and alerts
- more advanced cross-source ranking
- multi-tenant or team-based workflows
- deeper protocol-specific execution tooling

## Non-Negotiable Constraints

- Keep the scope tight until the alpha is validated
- Keep private keys out of the frontend
- Prefer clear data contracts over ad hoc objects
- Add new integrations behind server-only modules
- Do not expand into adjacent features without a product reason
