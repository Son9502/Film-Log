-- Scan backup check. Run in Supabase Dashboard → SQL Editor after 08_lab_dropoffs.sql.
-- Safe to re-run.

ALTER TABLE public.rolls ADD COLUMN IF NOT EXISTS backed_up_at    TEXT;
ALTER TABLE public.rolls ADD COLUMN IF NOT EXISTS backed_up_count INT;

NOTIFY pgrst, 'reload schema';
