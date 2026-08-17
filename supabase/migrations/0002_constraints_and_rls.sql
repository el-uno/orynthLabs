-- Upserts from the scoring worker need a stable conflict target. Without this
-- constraint every scoring run appends a duplicate launch row.
create unique index if not exists uniq_launch_projects_symbol on launch_projects(symbol);

create index if not exists idx_launch_snapshots_project_id on launch_snapshots(project_id);
create index if not exists idx_launch_snapshots_created_at on launch_snapshots(created_at desc);

-- Enable row level security on every table. No policies are defined, which
-- denies all anon/authenticated access; the service role key used by the
-- server bypasses RLS. Add explicit policies before exposing any table to a
-- browser-side Supabase client.
alter table launch_projects enable row level security;
alter table signal_events enable row level security;
alter table launch_snapshots enable row level security;
alter table jobs enable row level security;
