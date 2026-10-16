-- Drop Deck database schema for Supabase.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then Run.
-- Safe to run once on a new project.
--
-- Who can do what (enforced by row level security below):
--   Everyone with the link (no login): read everything; add pilots and edit
--     their names/preferences; edit hangars, attendance, personal builds; add
--     missing mechs.
--   Captains (signed-in users): everything, including events, drops/lineups,
--     rulesets, maps, official builds and deleting pilots.

create table pilots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  active boolean not null default true,
  notes text default '',
  prefs jsonb not null default '{}'::jsonb
);

create table pilot_mechs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pilot_id uuid not null references pilots(id) on delete cascade,
  variant text not null,
  mastered boolean not null default false,
  unique (pilot_id, variant)
);

create table custom_mechs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null unique,
  chassis text not null,
  tons integer not null check (tons between 20 and 100),
  tech text not null check (tech in ('IS', 'CL')),
  kind text not null default 'standard'
);

create table builds (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  chassis text not null,
  variant text,
  link text default '',
  code text default '',
  notes text default '',
  tags text[] not null default '{}',
  official boolean not null default false,
  pilot_id uuid references pilots(id) on delete set null
);

create table maps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null unique,
  active boolean not null default true
);

create table rulesets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  rules jsonb not null default '{}'::jsonb
);

create table events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  "date" date,
  team_size integer not null default 12 check (team_size between 1 and 12),
  ruleset_id uuid references rulesets(id) on delete set null,
  notes text default ''
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references events(id) on delete cascade,
  pilot_id uuid not null references pilots(id) on delete cascade,
  status text not null check (status in ('yes', 'maybe', 'no')),
  request text default '',
  unique (event_id, pilot_id)
);

create table drops (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid not null references events(id) on delete cascade,
  map_id uuid references maps(id) on delete set null,
  position integer not null default 0,
  result text check (result in ('win', 'loss', 'draw')),
  notes text default '',
  slots jsonb not null default '[]'::jsonb
);

-- Row level security ---------------------------------------------------------
alter table pilots enable row level security;
alter table pilot_mechs enable row level security;
alter table custom_mechs enable row level security;
alter table builds enable row level security;
alter table maps enable row level security;
alter table rulesets enable row level security;
alter table events enable row level security;
alter table attendance enable row level security;
alter table drops enable row level security;

-- Everyone can read everything.
create policy "read all" on pilots for select to anon, authenticated using (true);
create policy "read all" on pilot_mechs for select to anon, authenticated using (true);
create policy "read all" on custom_mechs for select to anon, authenticated using (true);
create policy "read all" on builds for select to anon, authenticated using (true);
create policy "read all" on maps for select to anon, authenticated using (true);
create policy "read all" on rulesets for select to anon, authenticated using (true);
create policy "read all" on events for select to anon, authenticated using (true);
create policy "read all" on attendance for select to anon, authenticated using (true);
create policy "read all" on drops for select to anon, authenticated using (true);

-- Pilot-side data: anyone can write.
create policy "anyone adds pilots" on pilots for insert to anon, authenticated with check (true);
create policy "anyone edits pilots" on pilots for update to anon, authenticated using (true) with check (true);
create policy "captains delete pilots" on pilots for delete to authenticated using (true);

create policy "anyone edits hangars" on pilot_mechs for all to anon, authenticated using (true) with check (true);
create policy "anyone edits attendance" on attendance for all to anon, authenticated using (true) with check (true);

create policy "anyone adds mechs" on custom_mechs for insert to anon, authenticated with check (true);
create policy "anyone edits mechs" on custom_mechs for update to anon, authenticated using (true) with check (true);
create policy "captains delete mechs" on custom_mechs for delete to authenticated using (true);

create policy "anyone edits personal builds" on builds for all to anon using (official = false) with check (official = false);
create policy "captains edit all builds" on builds for all to authenticated using (true) with check (true);

-- Captain-only data.
create policy "captains edit maps" on maps for all to authenticated using (true) with check (true);
create policy "captains edit rulesets" on rulesets for all to authenticated using (true) with check (true);
create policy "captains edit events" on events for all to authenticated using (true) with check (true);
create policy "captains edit drops" on drops for all to authenticated using (true) with check (true);

-- Live updates for everyone who has the app open.
alter publication supabase_realtime add table
  pilots, pilot_mechs, custom_mechs, builds, maps, rulesets, events, attendance, drops;

-- Starting data -------------------------------------------------------------
insert into maps (name) values
  ('Alpine Peaks'), ('Canyon Network'), ('Caustic Valley'), ('Crimson Strait'), ('Emerald Taiga'),
  ('Forest Colony'), ('Frozen City'), ('Grim Plexus'), ('HPG Manifold'), ('Hellebore Springs'),
  ('Mining Collective'), ('Polar Highlands'), ('River City'), ('Rubellite Oasis'), ('Solaris City'),
  ('Terra Therma'), ('Tourmaline Desert'), ('Vitric Forge'), ('Viridian Bog');

insert into rulesets (name, rules) values ('Open (no limits)', '{"tech": "any", "banLegendary": true}'::jsonb);
