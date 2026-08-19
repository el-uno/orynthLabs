-- Realigns the schema with the OrynthLabs product thesis.
--
-- The model was launch/token-centric: every tracked row required a ticker
-- symbol, which was also the unique upsert key. The thesis's primary input is
-- "early-stage MVPs, live tools, products in active development" — most of
-- which have no token and may be correctly advised never to launch one. The
-- schema could not represent them at all.

-- 1. Identity independent of a token.
alter table launch_projects add column if not exists slug text;

update launch_projects
set slug = lower(regexp_replace(coalesce(slug, name), '[^a-zA-Z0-9]+', '-', 'g'))
where slug is null;

alter table launch_projects alter column slug set not null;

drop index if exists uniq_launch_projects_symbol;
create unique index if not exists uniq_launch_projects_slug on launch_projects(slug);

-- Token identity is now optional: it exists only after a launch is designed.
alter table launch_projects alter column symbol drop not null;
alter table launch_projects alter column chain drop not null;
alter table launch_projects alter column chain drop default;

-- 2. Opportunities and companies are different things.
-- An opportunity is a market gap with no company behind it yet (thesis stage
-- 1); a company is a real product being built (stages 2-5).
alter table launch_projects add column if not exists entity_kind text not null default 'company';
alter table launch_projects drop constraint if exists launch_projects_entity_kind_check;
alter table launch_projects add constraint launch_projects_entity_kind_check
  check (entity_kind in ('opportunity', 'company'));

-- 3. The tokenization decision, which the old model could not express.
-- "Good product, do not tokenize yet" is a valid and important outcome.
alter table launch_projects add column if not exists recommendation text;
alter table launch_projects drop constraint if exists launch_projects_recommendation_check;
alter table launch_projects add constraint launch_projects_recommendation_check
  check (recommendation is null or recommendation in
    ('launch_now', 'build_further', 'do_not_tokenize', 'insufficient_evidence'));

-- 4. Readiness is multi-dimensional: Product, Founder, Market, Community,
-- Distribution, Economic Design. A single integer cannot carry that, and
-- cannot explain which axis is holding a company back.
alter table launch_projects add column if not exists readiness jsonb not null default '{}'::jsonb;

create index if not exists idx_launch_projects_entity_kind on launch_projects(entity_kind);
create index if not exists idx_launch_projects_recommendation on launch_projects(recommendation);

-- 5. Signals belong to a signal family, not merely a source system.
-- The thesis's five families are attention, builder, capital, consumer and
-- market structure. `kind` recorded the source (github, helius), so
-- corroboration was being measured across APIs rather than across independent
-- kinds of evidence — which is the whole point of the intersection principle.
alter table signal_events add column if not exists family text;
create index if not exists idx_signal_events_family on signal_events(family);
