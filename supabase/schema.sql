-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Hackathon demo policies: anyone with the anon key can read and write.
-- Tighten these before any real use.

create table if not exists volunteers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  radius_km double precision not null default 10,
  species_ok text[] not null default '{}',
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists rehabs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  species_ok text[] not null default '{}',
  phone text,
  hours text,
  source text not null default 'tpwd' check (source in ('tpwd', 'serpapi'))
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  photo_url text not null,
  lat double precision not null,
  lng double precision not null,
  species text,
  animal_type text,           -- matches volunteers.species_ok / rehabs.species_ok
  age_stage text,
  verdict text,
  urgency text,
  ai_json jsonb,
  note text,
  near_fire boolean not null default false,
  fire_distance_km double precision,
  rehab_id uuid references rehabs(id),
  status text not null default 'open'
    check (status in ('open', 'accepted', 'picked_up', 'delivered')),
  volunteer_id uuid references volunteers(id),
  created_at timestamptz not null default now()
);

alter table volunteers enable row level security;
alter table rehabs enable row level security;
alter table reports enable row level security;

create policy "demo all volunteers" on volunteers for all to anon using (true) with check (true);
create policy "demo read rehabs" on rehabs for select to anon using (true);
create policy "demo all reports" on reports for all to anon using (true) with check (true);

-- Volunteers' email and phone can be written but not read with the public key.
revoke select on volunteers from anon, authenticated;
grant select (id, name, lat, lng, radius_km, species_ok, created_at) on volunteers to anon, authenticated;

-- Live updates for the volunteer list and the finder's status screen
alter publication supabase_realtime add table reports;

-- Public photo bucket (Google Lens needs a public URL)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "demo upload photos" on storage.objects
  for insert to anon with check (bucket_id = 'photos');
create policy "demo read photos" on storage.objects
  for select to anon using (bucket_id = 'photos');
