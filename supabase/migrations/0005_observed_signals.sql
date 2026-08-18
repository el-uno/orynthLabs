-- Stage 1: separate observed signals from derived scoring output.
--
-- `signal_events` is now exclusively a record of things observed in the world.
-- Scoring output (the model's justification for a score) is an artifact of a
-- scoring run and belongs on `launch_snapshots.payload` instead. Writing it
-- back here created a feedback loop where scoring consumed its own output and
-- the table doubled on every run.

-- Stable per-source identity, so re-running ingestion updates a row instead of
-- appending a duplicate. Ingestion that is not idempotent is the same bug in a
-- different costume.
alter table signal_events add column if not exists external_id text;

-- When the event actually happened upstream, as opposed to when we stored it.
alter table signal_events add column if not exists observed_at timestamptz;

-- Not partial: PostgREST cannot express an index predicate in ON CONFLICT, so a
-- partial index is unusable for upserts. It is also unnecessary — Postgres
-- treats NULLs as distinct, so rows without an external id never collide.
create unique index if not exists uniq_signal_events_source_external
  on signal_events(source, external_id);

create index if not exists idx_signal_events_observed_at on signal_events(observed_at desc);
create index if not exists idx_signal_events_kind on signal_events(kind);
