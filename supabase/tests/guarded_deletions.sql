-- Disposable database only, after migrations 13-15. Requires two fixture users.
BEGIN;
CREATE TEMP TABLE deletion_fixture AS
SELECT
  (SELECT id FROM auth.users ORDER BY id LIMIT 1) AS owner_id,
  (SELECT id FROM auth.users ORDER BY id OFFSET 1 LIMIT 1) AS other_id,
  'delete-roll-' || md5(random()::text || clock_timestamp()::text) AS roll_id,
  'delete-shot-' || md5(random()::text || clock_timestamp()::text) AS shot_id;
GRANT SELECT ON deletion_fixture TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM deletion_fixture WHERE owner_id IS NULL OR other_id IS NULL) THEN
    RAISE EXCEPTION 'Deletion tests require two fixture users';
  END IF;
END;
$$;
SELECT set_config('request.jwt.claim.sub', owner_id::text, true) FROM deletion_fixture;
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  f deletion_fixture%ROWTYPE;
  result jsonb;
  fields jsonb := '{"name":"test","film_stock_id":"stock","camera_id":"camera","iso":"400","frame_count":36,"status":"Shooting","loaded_at":"test","created_at":"test","updated_at":"test","is_public":true}';
BEGIN
  SELECT * INTO f FROM deletion_fixture;
  result := public.guarded_roll_write(f.roll_id, NULL, fields);
  IF result <> '{"status":"saved","revision":1}'::jsonb THEN RAISE EXCEPTION 'Create roll: %', result; END IF;
  result := public.guarded_shot_write(f.shot_id, f.roll_id, NULL, '{"frame":1,"notes":"original"}');
  IF result <> '{"status":"saved","revision":1}'::jsonb THEN RAISE EXCEPTION 'Create frame: %', result; END IF;
  result := public.guarded_roll_delete(f.roll_id, 1);
  IF result <> '{"status":"has_frames"}'::jsonb THEN RAISE EXCEPTION 'Roll with frames: %', result; END IF;
  result := public.guarded_shot_write(f.shot_id, f.roll_id, 1, '{"notes":"updated"}');
  IF result <> '{"status":"saved","revision":2}'::jsonb THEN RAISE EXCEPTION 'Update frame: %', result; END IF;
  result := public.guarded_shot_delete(f.shot_id, f.roll_id, 1);
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Stale frame deletion: %', result; END IF;
  PERFORM set_config('request.jwt.claim.sub', f.other_id::text, true);
  result := public.guarded_shot_delete(f.shot_id, f.roll_id, 2);
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Cross-owner frame deletion: %', result; END IF;
  PERFORM set_config('request.jwt.claim.sub', f.owner_id::text, true);
  result := public.guarded_shot_delete(f.shot_id, f.roll_id, 2);
  IF result <> '{"status":"deleted","revision":3}'::jsonb THEN RAISE EXCEPTION 'Delete frame: %', result; END IF;
  IF EXISTS (SELECT 1 FROM public.shots WHERE id = f.shot_id) THEN RAISE EXCEPTION 'Deleted frame visible'; END IF;
  result := public.guarded_shot_write(f.shot_id, f.roll_id, 3, '{"notes":"resurrect"}');
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Update deleted frame: %', result; END IF;
  result := public.guarded_shot_write(f.shot_id, f.roll_id, NULL, '{"frame":1}');
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Recreate deleted frame: %', result; END IF;
  result := public.guarded_roll_write(f.roll_id, 1, '{"name":"updated"}');
  IF result <> '{"status":"saved","revision":2}'::jsonb THEN RAISE EXCEPTION 'Update roll: %', result; END IF;
  result := public.guarded_roll_delete(f.roll_id, 1);
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Stale roll deletion: %', result; END IF;
  result := public.guarded_roll_delete(f.roll_id, 2);
  IF result <> '{"status":"deleted","revision":3}'::jsonb THEN RAISE EXCEPTION 'Delete roll: %', result; END IF;
  IF EXISTS (SELECT 1 FROM public.rolls WHERE id = f.roll_id) THEN RAISE EXCEPTION 'Deleted roll visible'; END IF;
  result := public.guarded_roll_write(f.roll_id, 3, '{"name":"resurrect"}');
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Update deleted roll: %', result; END IF;
  result := public.guarded_roll_write(f.roll_id, NULL, fields);
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Recreate deleted roll: %', result; END IF;
  result := public.guarded_shot_write(f.shot_id || '-new', f.roll_id, NULL, '{"frame":2}');
  IF result <> '{"status":"conflict"}'::jsonb THEN RAISE EXCEPTION 'Frame in deleted roll: %', result; END IF;
  IF (SELECT count(*) FROM public.roll_sync_tombstones() WHERE id IN (f.roll_id, f.shot_id)) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.roll_sync_tombstones() WHERE kind = 'frame' AND id = f.shot_id AND roll_id = f.roll_id AND revision = 3) THEN
    RAISE EXCEPTION 'Owner tombstone list incorrect';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', f.other_id::text, true);
  IF EXISTS (SELECT 1 FROM public.roll_sync_tombstones() WHERE id IN (f.roll_id, f.shot_id))
     OR EXISTS (SELECT 1 FROM public.rolls WHERE id = f.roll_id) THEN
    RAISE EXCEPTION 'Another user can see deleted records or tombstones';
  END IF;
  BEGIN
    PERFORM public.guarded_roll_delete(f.roll_id, NULL);
    RAISE EXCEPTION 'Invalid revision was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END;
$$;
RESET ROLE;
DO $$
DECLARE f deletion_fixture%ROWTYPE;
BEGIN
  SELECT * INTO f FROM deletion_fixture;
  IF NOT EXISTS (SELECT 1 FROM public.shots WHERE id = f.shot_id AND notes = 'updated' AND sync_deleted_at IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.rolls WHERE id = f.roll_id AND name = 'updated' AND sync_deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Tombstones did not retain original data';
  END IF;
  IF has_function_privilege('anon', 'public.guarded_roll_delete(text,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.guarded_shot_delete(text,text,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.roll_sync_tombstones()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role can access deletion functions';
  END IF;
END;
$$;
ROLLBACK;
