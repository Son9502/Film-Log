-- Run only against a disposable database after 13_roll_revision_tracking.sql.
-- Requires at least one auth.users row. All fixture writes are rolled back.
BEGIN;

DO $$
DECLARE
  owner_id uuid;
  roll_id text := 'revision-test-roll-' || md5(random()::text || clock_timestamp()::text);
  shot_id text := 'revision-test-shot-' || md5(random()::text || clock_timestamp()::text);
  revision integer;
BEGIN
  SELECT id INTO owner_id FROM auth.users LIMIT 1;
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Revision test requires a fixture user';
  END IF;

  INSERT INTO public.rolls
    (id, user_id, film_stock_id, camera_id, iso, frame_count, status, loaded_at, created_at, updated_at, sync_revision)
  VALUES
    (roll_id, owner_id, 'stock', 'camera', '400', 36, 'Shooting', '2026-01-01', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 999);
  SELECT sync_revision INTO revision FROM public.rolls WHERE id = roll_id;
  IF revision <> 1 THEN RAISE EXCEPTION 'Roll insert revision: expected 1, got %', revision; END IF;

  INSERT INTO public.shots (id, roll_id, user_id, frame, sync_revision)
  VALUES (shot_id, roll_id, owner_id, 1, 999);
  SELECT sync_revision INTO revision FROM public.shots WHERE id = shot_id;
  IF revision <> 1 THEN RAISE EXCEPTION 'Shot insert revision: expected 1, got %', revision; END IF;

  UPDATE public.rolls SET name = 'changed', sync_revision = 999 WHERE id = roll_id;
  SELECT sync_revision INTO revision FROM public.rolls WHERE id = roll_id;
  IF revision <> 2 THEN RAISE EXCEPTION 'Roll update revision: expected 2, got %', revision; END IF;
  SELECT sync_revision INTO revision FROM public.shots WHERE id = shot_id;
  IF revision <> 1 THEN RAISE EXCEPTION 'Roll update changed shot revision: %', revision; END IF;

  INSERT INTO public.shots (id, roll_id, user_id, frame)
  VALUES (shot_id, roll_id, owner_id, 2)
  ON CONFLICT (id) DO UPDATE SET frame = EXCLUDED.frame;
  SELECT sync_revision INTO revision FROM public.shots WHERE id = shot_id;
  IF revision <> 2 THEN RAISE EXCEPTION 'Shot upsert revision: expected 2, got %', revision; END IF;

  UPDATE public.shots SET sync_revision = -1 WHERE id = shot_id;
  SELECT sync_revision INTO revision FROM public.shots WHERE id = shot_id;
  IF revision <> 3 THEN RAISE EXCEPTION 'Shot update revision: expected 3, got %', revision; END IF;
END;
$$;

ROLLBACK;
