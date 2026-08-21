-- Build Opportunities are assessed differently from companies.
--
-- Readiness axes (product, founder, community...) presuppose a company that
-- exists. An opportunity has no product and no founder; the question is
-- whether a gap worth building into is visible. It therefore carries its own
-- verdict rather than a tokenization recommendation, which would be
-- meaningless for something nobody has built yet.
alter table launch_projects add column if not exists opportunity_verdict text;

alter table launch_projects drop constraint if exists launch_projects_opportunity_verdict_check;
alter table launch_projects add constraint launch_projects_opportunity_verdict_check
  check (opportunity_verdict is null or opportunity_verdict in
    ('strong', 'emerging', 'crowded', 'insufficient_evidence'));

create index if not exists idx_launch_projects_opportunity_verdict
  on launch_projects(opportunity_verdict);
