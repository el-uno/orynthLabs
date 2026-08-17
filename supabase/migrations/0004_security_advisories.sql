-- Fixes two security advisories raised against migration 0001.

-- 1. A trigger function with a mutable search_path can be hijacked by a role
-- that puts a shadowing object earlier in its own search_path. Pinning it to
-- empty forces resolution through pg_catalog only.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. pgvector was installed into `public`, which mixes extension objects with
-- application tables and widens what any role with public access can reach.
-- Moving it is trivial while `signal_events.embedding` holds no rows; it gets
-- materially harder once embeddings exist, so it happens now rather than in
-- the phase that starts writing them.
alter extension vector set schema extensions;
