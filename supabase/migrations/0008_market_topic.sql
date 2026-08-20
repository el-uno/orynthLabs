-- Market-structure evidence answers "does a good solution already exist for
-- this problem?", which needs to know what problem the entity addresses.
-- Neither a repo nor a mint expresses that: a company's market is not the same
-- thing as its codebase, and an opportunity has no codebase at all.
alter table launch_projects add column if not exists market_topic text;

create index if not exists idx_launch_projects_market_topic on launch_projects(market_topic);
