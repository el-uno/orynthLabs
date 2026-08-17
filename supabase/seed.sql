insert into launch_projects (name, symbol, status, score, github_owner, github_repo, partner_ref)
values
  ('Atlas Protocol', 'ATLS', 'ready', 92, 'atlas-protocol', 'atlas', 'partner:atlas'),
  ('Nova Index', 'NOVA', 'watching', 78, 'nova-index', 'nova', 'partner:nova'),
  ('Cipher Labs', 'CIPHER', 'draft', 61, 'cipher-labs', 'cipher', 'partner:cipher')
on conflict do nothing;
