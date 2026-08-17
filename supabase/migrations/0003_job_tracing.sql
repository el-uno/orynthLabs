-- Operational tracing for retried jobs. Without an attempt count and a link to
-- the BullMQ job, a failed row in this table cannot be matched to the queue
-- entry an operator would need to retry.
alter table jobs add column if not exists attempts integer not null default 0;
alter table jobs add column if not exists queue_job_id text;

create index if not exists idx_jobs_queue_job_id on jobs(queue_job_id);
create index if not exists idx_jobs_created_at on jobs(created_at desc);

-- Statuses are a closed set; a typo in worker code should fail loudly rather
-- than silently writing a status nothing queries for.
alter table jobs drop constraint if exists jobs_status_check;
alter table jobs add constraint jobs_status_check
  check (status in ('queued', 'running', 'retrying', 'succeeded', 'failed'));
