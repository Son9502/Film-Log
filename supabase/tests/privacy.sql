-- Disposable database only, after migrations 13-15 and 21. Requires two fixture users.
-- Checks that another user can't read a roll or its frames, even one marked public.
-- One block, so it works however the SQL Editor splits or highlights the script.
BEGIN;

DO $$
DECLARE
  v_owner uuid;
  v_other uuid;
  v_roll text := 'privacy-roll-' || md5(random()::text || clock_timestamp()::text);
  v_shot text := 'privacy-shot-' || md5(random()::text || clock_timestamp()::text);
  result jsonb;
  n integer;
BEGIN
  -- Read the fixture users before dropping to the app's role (it can't see auth.users).
  SELECT id INTO v_owner FROM auth.users ORDER BY id LIMIT 1;
  SELECT id INTO v_other FROM auth.users ORDER BY id OFFSET 1 LIMIT 1;
  IF v_owner IS NULL OR v_other IS NULL THEN
    RAISE EXCEPTION 'Privacy tests require two fixture users';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  SET LOCAL ROLE authenticated;

  result := public.guarded_roll_write(v_roll, NULL,
    '{"name":"private","film_stock_id":"stock","camera_id":"camera","iso":"400","frame_count":36,"status":"Shooting","loaded_at":"2026-01-01","created_at":"2026-01-01T00:00:00.000Z","updated_at":"2026-01-01T00:00:00.000Z","is_public":true}');
  IF result <> '{"status":"saved","revision":1}'::jsonb THEN RAISE EXCEPTION 'Create roll: %', result; END IF;
  result := public.guarded_shot_write(v_shot, v_roll, NULL, '{"frame":1,"latitude":51.5,"longitude":-0.1,"notes":"home"}');
  IF result <> '{"status":"saved","revision":1}'::jsonb THEN RAISE EXCEPTION 'Create frame: %', result; END IF;

  SELECT count(*) INTO n FROM public.shots s WHERE s.id = v_shot;
  IF n <> 1 THEN RAISE EXCEPTION 'Owner should read their frame, got % rows', n; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  SELECT count(*) INTO n FROM public.rolls r WHERE r.id = v_roll;
  IF n <> 0 THEN RAISE EXCEPTION 'Another user read a public roll'; END IF;
  SELECT count(*) INTO n FROM public.shots s WHERE s.id = v_shot;
  IF n <> 0 THEN RAISE EXCEPTION 'Another user read a frame of a public roll'; END IF;

  RAISE NOTICE 'Privacy tests passed';
END;
$$;

ROLLBACK;
