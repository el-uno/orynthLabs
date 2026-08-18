-- Chain ingestion needs an address to look at. Until now launch_projects
-- identified a project only by GitHub repo and partner ref, so there was
-- nothing on-chain to query.
alter table launch_projects add column if not exists token_mint text;
alter table launch_projects add column if not exists treasury_address text;

create index if not exists idx_launch_projects_token_mint on launch_projects(token_mint);
