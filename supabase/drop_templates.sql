-- Drop templates (added 2026-10-16). Run once in Supabase -> SQL Editor -> New query on a database set up
-- with an older schema.sql. (New setups get this from schema.sql.)
create table drop_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  ruleset_id uuid references rulesets(id) on delete set null,
  team_size integer not null default 12 check (team_size between 1 and 12),
  map_id uuid references maps(id) on delete set null,
  notes text default '',
  slots jsonb not null default '[]'::jsonb
);
alter table drop_templates enable row level security;
create policy "read all" on drop_templates for select to anon, authenticated using (true);
create policy "captains edit drop templates" on drop_templates for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table drop_templates;
