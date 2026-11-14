-- Disposable database only, after migrations 13 and 14. Requires two test users.
-- Do not run against production: this temporarily changes the request identity.
BEGIN;

CREATE TEMP TABLE sync_test_fixture AS
SELECT
  (SELECT id FROM auth.users ORDER BY id LIMIT 1) AS owner_id,
  (SELECT id FROM auth.users ORDER BY id OFFSET 1 LIMIT 1) AS other_id,
  'guard-test-' || md5(random()::text || clock_timestamp()::text) AS roll_id,
  'guard-test-' || md5(random()::text || clock_timestamp()::text) AS shot_id;
GRANT SELECT ON sync_test_fixture TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM sync_test_fixture WHERE owner_id IS NULL OR other_id IS NULL) THEN
    RAISE EXCEPTION 'Guarded write tests require two fixture users';
  END IF;
END;
$$;

SELECT set_config('request.jwt.claim.sub', owner_id::text, true) FROM sync_test_fixture;
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  f sync_test_fixture%ROWTYPE;
  result jsonb;
  affected integer;
BEGIN
  SELECT * INTO f FROM sync_test_fixture;
  result := public.guarded_roll_write(f.roll_id, NULL, jsonb_build_object(
    'name', 'original', 'film_stock_id', 'stock', 'camera_id', 'camera', 'iso', '400',
    'frame_count', 36, 'status', 'Shooting', 'loaded_at', '2026-01-01', 'created_at', '2026-01-01T00:00:00.000Z', 'updated_at', '2026-01-01T00:00:00.000Z'
  ));
  IF result <> '{"status":"saved","revision":1}'::jsonb THEN RAISE EXCEPTION 'Roll create: %', result; END IF;

  result := public.guarded_roll_write(f.roll_id, 1, '{"name":"changed"}');
  IF result <> '{"status":"saved","revision":2}'::jsonb THEN RAISE EXCEPTION 'Roll update: %', result; END IF;
  result := public.guarded_roll_write(f.roll_id, 1, '{"name":"stale"}');
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Stale roll update: %', result; END IF;
  result := public.guarded_roll_write(f.roll_id, NULL, jsonb_build_object(
    'name', 'duplicate', 'film_stock_id', 'stock', 'camera_id', 'camera', 'iso', '400',
    'frame_count', 36, 'status', 'Shooting', 'loaded_at', '2026-01-01', 'created_at', '2026-01-01T00:00:00.000Z', 'updated_at', '2026-01-01T00:00:00.000Z'
  ));
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Duplicate roll create: %', result; END IF;

  result := public.guarded_shot_write(f.shot_id, f.roll_id, NULL, '{"frame":1,"notes":"original"}');
  IF result <> '{"status":"saved","revision":1}'::jsonb THEN RAISE EXCEPTION 'Frame create: %', result; END IF;
  result := public.guarded_shot_write(f.shot_id, f.roll_id, 1, '{"notes":"changed"}');
  IF result <> '{"status":"saved","revision":2}'::jsonb THEN RAISE EXCEPTION 'Frame update: %', result; END IF;
  result := public.guarded_shot_write(f.shot_id, f.roll_id, 1, '{"notes":"stale"}');
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Stale frame update: %', result; END IF;
  result := public.guarded_shot_write(f.shot_id, f.roll_id || '-missing', 2, '{"notes":"wrong parent"}');
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Wrong frame parent: %', result; END IF;
  result := public.guarded_roll_write(f.roll_id || '-missing', 1, '{"name":"missing"}');
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Missing roll update: %', result; END IF;

  UPDATE public.rolls SET name = 'unsafe' WHERE id = f.roll_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Direct roll update was not blocked'; END IF;
  DELETE FROM public.shots WHERE id = f.shot_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Direct frame delete was not blocked'; END IF;
  UPDATE public.shots SET notes = 'unsafe' WHERE id = f.shot_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Direct frame update was not blocked'; END IF;
  DELETE FROM public.rolls WHERE id = f.roll_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Direct roll delete was not blocked'; END IF;
  BEGIN
    INSERT INTO public.shots (id, roll_id, user_id, frame) VALUES (f.shot_id || '-unsafe', f.roll_id, f.owner_id, 2);
    RAISE EXCEPTION 'Direct frame insert was not blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.rolls (id, user_id, film_stock_id, camera_id, iso, frame_count, status, loaded_at, created_at, updated_at)
    VALUES (f.roll_id || '-unsafe', f.owner_id, 'stock', 'camera', '400', 36, 'Shooting', '2026-01-01', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    RAISE EXCEPTION 'Direct roll insert was not blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.shots (id, roll_id, user_id, frame) VALUES (f.shot_id, f.roll_id, f.owner_id, 2)
    ON CONFLICT (id) DO UPDATE SET frame = EXCLUDED.frame;
    RAISE EXCEPTION 'Direct frame upsert was not blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.guarded_roll_write(f.roll_id, 2, '{"user_id":"00000000-0000-0000-0000-000000000000"}');
    RAISE EXCEPTION 'Reserved field was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.guarded_shot_write(f.shot_id, f.roll_id, 0, '{"notes":"invalid"}');
    RAISE EXCEPTION 'Invalid revision was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', f.other_id::text, true);
  result := public.guarded_roll_write(f.roll_id, 2, '{"name":"other user"}');
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Cross-owner roll update: %', result; END IF;
  result := public.guarded_shot_write(f.shot_id || '-other', f.roll_id, NULL, '{"frame":2}');
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Cross-owner parent: %', result; END IF;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM public.guarded_roll_write(f.roll_id, 2, '{"name":"unauthenticated"}');
    RAISE EXCEPTION 'Missing authenticated identity was accepted';
  EXCEPTION WHEN invalid_authorization_specification THEN NULL;
  END;
END;
$$;

RESET ROLE;
DO $$
DECLARE
  f sync_test_fixture%ROWTYPE;
BEGIN
  SELECT * INTO f FROM sync_test_fixture;
  IF NOT EXISTS (SELECT 1 FROM public.rolls WHERE id = f.roll_id AND name = 'changed' AND sync_revision = 2)
     OR NOT EXISTS (SELECT 1 FROM public.shots WHERE id = f.shot_id AND notes = 'changed' AND sync_revision = 2) THEN
    RAISE EXCEPTION 'Guarded tests left unexpected record values';
  END IF;
  IF has_function_privilege('anon', 'public.guarded_roll_write(text,integer,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.guarded_shot_write(text,text,integer,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role can execute guarded writes';
  END IF;
END;
$$;
ROLLBACK;
