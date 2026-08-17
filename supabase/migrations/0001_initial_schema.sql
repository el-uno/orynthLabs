create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists launch_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  symbol text not null,
  chain text not null default 'Solana',
  status text not null default 'draft',
  score integer not null default 0,
  github_owner text,
  github_repo text,
  partner_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists signal_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references launch_projects(id) on delete cascade,
  source text not null,
  kind text not null,
  severity text not null,
  title text not null,
  detail text not null,
  value text,
  score_delta integer not null default 0,
  raw jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create table if not exists launch_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references launch_projects(id) on delete cascade,
  source text not null,
  payload jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  queue_name text not null,
  job_type text not null,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  error text,
  run_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_launch_projects_status on launch_projects(status);
create index if not exists idx_launch_projects_score on launch_projects(score desc);
create index if not exists idx_signal_events_project_id on signal_events(project_id);
create index if not exists idx_signal_events_created_at on signal_events(created_at desc);
create index if not exists idx_jobs_queue_status on jobs(queue_name, status);
create index if not exists idx_jobs_run_after on jobs(run_after);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_launch_projects_updated_at on launch_projects;
create trigger trg_launch_projects_updated_at
before update on launch_projects
for each row execute function set_updated_at();

drop trigger if exists trg_jobs_updated_at on jobs;
create trigger trg_jobs_updated_at
before update on jobs
for each row execute function set_updated_at();
