-- Adds email and phone to volunteers. Run once in Supabase:
-- SQL Editor > New query > paste > Run.

alter table volunteers add column if not exists email text;
alter table volunteers add column if not exists phone text;

-- Keep contact details private. The app can save them, but nobody can read
-- them back with the public key; you can still see them in the Supabase
-- Table Editor.
revoke select on volunteers from anon, authenticated;
grant select (id, name, lat, lng, radius_km, species_ok, created_at) on volunteers to anon, authenticated;
