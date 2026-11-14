-- Roll/frame sync, step 1 of 3: server-controlled revision numbers on rolls and shots.
-- Every insert starts at 1 and every update adds 1, whoever writes it. The app uses
-- these to detect edits made on another device (see src/utils/rollMerge.ts).
-- Run 13, 14 and 15 together, in order, in the Supabase SQL Editor. Back up first
-- (Database → Backups) or export a local snapshot from Settings on each device.
-- Safe to re-run.

BEGIN;

ALTER TABLE public.rolls ADD COLUMN IF NOT EXISTS sync_revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.shots ADD COLUMN IF NOT EXISTS sync_revision integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.track_roll_sync_revision()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.sync_revision := 1;
  ELSE
    NEW.sync_revision := OLD.sync_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_roll_sync_revision ON public.rolls;
CREATE TRIGGER track_roll_sync_revision
  BEFORE INSERT OR UPDATE ON public.rolls
  FOR EACH ROW EXECUTE FUNCTION public.track_roll_sync_revision();

DROP TRIGGER IF EXISTS track_roll_sync_revision ON public.shots;
CREATE TRIGGER track_roll_sync_revision
  BEFORE INSERT OR UPDATE ON public.shots
  FOR EACH ROW EXECUTE FUNCTION public.track_roll_sync_revision();

NOTIFY pgrst, 'reload schema';
COMMIT;
