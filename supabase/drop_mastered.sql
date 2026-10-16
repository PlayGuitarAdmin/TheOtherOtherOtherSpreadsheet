-- Optional cleanup: the "mastered" flag on hangar rows was removed from the app.
-- The column is harmless if left in place (it defaults to false). Run this in the
-- Supabase SQL editor to remove it from an existing database. It deletes the stored flags.
alter table pilot_mechs drop column if exists mastered;
