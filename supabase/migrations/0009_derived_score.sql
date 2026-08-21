-- The top-line score was circular: with no model configured, scoring read
-- `launch_projects.score` straight off the row, used it to gate the status
-- (score >= 75 => ready), then wrote the same number back. The row asserted
-- its own readiness. A seeded 92 made an entity "ready" without any evidence
-- earning it — structurally the same fault as scoring consuming its own
-- output from signal_events, travelling through a different column.
--
-- The score is now the readiness composite, derived from observed signals.
-- Where no axis is measurable there is no score, so the column must accept
-- null: 0 would read as "assessed and poor" rather than "not assessed", the
-- same conflation the readiness axes already avoid.
alter table launch_projects alter column score drop not null;
alter table launch_projects alter column score drop default;

alter table launch_snapshots alter column score drop not null;
alter table launch_snapshots alter column score drop default;
