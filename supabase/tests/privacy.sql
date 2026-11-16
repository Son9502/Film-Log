-- Disposable database only, after migrations 13-15 and 21. Requires two fixture users.
-- Checks that another user can't read a roll or its frames, even one marked public.
BEGIN;
CREATE TEMP TABLE privacy_fixture AS
SELECT
  (SELECT id FROM auth.users ORDER BY id LIMIT 1) AS owner_id,
  (SELECT id FROM auth.users ORDER BY id OFFSET 1 LIMIT 1) AS other_id,
  'privacy-roll-' || md5(random()::text || clock_timestamp()::text) AS roll_id,
  'privacy-shot-' || md5(random()::text || clock_timestamp()::text) AS shot_id;
GRANT SELECT ON privacy_fixture TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM privacy_fixture WHERE owner_id IS NULL OR other_id IS NULL) THEN
    RAISE EXCEPTION 'Privacy tests require two fixture users';
  END IF;
END;
$$;
SELECT set_config('request.jwt.claim.sub', owner_id::text, true) FROM privacy_fixture;
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  f privacy_fixture%ROWTYPE;
  result jsonb;
  n integer;
BEGIN
  SELECT * INTO f FROM privacy_fixture;
  result := public.guarded_roll_write(f.roll_id, NULL,
    '{"name":"private","film_stock_id":"stock","camera_id":"camera","iso":"400","frame_count":36,"status":"Shooting","loaded_at":"2026-01-01","created_at":"2026-01-01T00:00:00.000Z","updated_at":"2026-01-01T00:00:00.000Z","is_public":true}');
  IF result <> '{"status":"saved","revision":1}'::jsonb THEN RAISE EXCEPTION 'Create roll: %', result; END IF;
  result := public.guarded_shot_write(f.shot_id, f.roll_id, NULL, '{"frame":1,"latitude":51.5,"longitude":-0.1,"notes":"home"}');
  IF result <> '{"status":"saved","revision":1}'::jsonb THEN RAISE EXCEPTION 'Create frame: %', result; END IF;

  SELECT count(*) INTO n FROM public.shots WHERE id = f.shot_id;
  IF n <> 1 THEN RAISE EXCEPTION 'Owner should read their frame, got % rows', n; END IF;

  PERFORM set_config('request.jwt.claim.sub', f.other_id::text, true);
  SELECT count(*) INTO n FROM public.rolls WHERE id = f.roll_id;
  IF n <> 0 THEN RAISE EXCEPTION 'Another user read a public roll'; END IF;
  SELECT count(*) INTO n FROM public.shots WHERE id = f.shot_id;
  IF n <> 0 THEN RAISE EXCEPTION 'Another user read a frame of a public roll'; END IF;
END;
$$;

ROLLBACK;
