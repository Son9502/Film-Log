-- Roll/frame sync, step 2 of 3: revision-checked writes.
-- Blocks direct roll/shot inserts, updates and deletes for ordinary clients (so an
-- out-of-date app can't overwrite newer data) and adds guarded_roll_write /
-- guarded_shot_write, which only save when the caller's expected revision matches.
-- Older app versions that still write directly will get permission errors: reload
-- the web app and restart Expo Go on every device after running this.
-- Run in the role that owns the tables (the SQL Editor's default). Safe to re-run.

BEGIN;

DO $$
DECLARE
  table_name text;
  table_info record;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['rolls', 'shots'] LOOP
    SELECT c.relowner, c.relforcerowsecurity INTO table_info
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = table_name AND c.relkind = 'r';
    IF NOT FOUND OR table_info.relowner <> (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
       OR table_info.relforcerowsecurity THEN
      RAISE EXCEPTION 'Migration role must own public.% and FORCE ROW LEVEL SECURITY must be disabled', table_name;
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE public.rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rolls ADD COLUMN IF NOT EXISTS sync_deleted_at timestamptz;
ALTER TABLE public.shots ADD COLUMN IF NOT EXISTS sync_deleted_at timestamptz;

-- Restrictive policies are ANDed with existing permissive policies. They block
-- ordinary direct writes even if an old permissive policy remains in place.
DROP POLICY IF EXISTS sync_no_direct_insert ON public.rolls;
CREATE POLICY sync_no_direct_insert ON public.rolls AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (false);
DROP POLICY IF EXISTS sync_no_direct_update ON public.rolls;
CREATE POLICY sync_no_direct_update ON public.rolls AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS sync_no_direct_delete ON public.rolls;
CREATE POLICY sync_no_direct_delete ON public.rolls AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false);
DROP POLICY IF EXISTS sync_no_direct_insert ON public.shots;
CREATE POLICY sync_no_direct_insert ON public.shots AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (false);
DROP POLICY IF EXISTS sync_no_direct_update ON public.shots;
CREATE POLICY sync_no_direct_update ON public.shots AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS sync_no_direct_delete ON public.shots;
CREATE POLICY sync_no_direct_delete ON public.shots AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false);

CREATE OR REPLACE FUNCTION public.guarded_roll_write(p_id text, p_expected_revision integer, p_fields jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  owner_id uuid := auth.uid();
  payload public.rolls%ROWTYPE;
  new_revision integer;
  allowed constant text[] := ARRAY[
    'name', 'film_stock_id', 'camera_id', 'iso', 'frame_count', 'status', 'loaded_at',
    'lab_at', 'lab_dropoff_id', 'backed_up_at', 'backed_up_count', 'developed_at',
    'notes', 'location_label', 'developer', 'dilution', 'dev_time', 'dev_temp',
    'push_pull', 'fixer', 'photo_flo', 'is_public', 'created_at', 'updated_at'
  ];
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_id IS NULL OR btrim(p_id) = '' OR p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object'
     OR (p_expected_revision IS NOT NULL AND p_expected_revision < 1)
     OR p_fields - allowed <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Invalid roll write arguments' USING ERRCODE = '22023';
  END IF;

  IF p_expected_revision IS NULL THEN
    payload := jsonb_populate_record(NULL::public.rolls, p_fields);
    INSERT INTO public.rolls
      (id, user_id, name, film_stock_id, camera_id, iso, frame_count, status, loaded_at,
       lab_at, lab_dropoff_id, backed_up_at, backed_up_count, developed_at, notes,
       location_label, developer, dilution, dev_time, dev_temp, push_pull, fixer,
       photo_flo, is_public, created_at, updated_at)
    VALUES
      (p_id, owner_id, payload.name, payload.film_stock_id, payload.camera_id, payload.iso,
       payload.frame_count, payload.status, payload.loaded_at, payload.lab_at, payload.lab_dropoff_id,
       payload.backed_up_at, payload.backed_up_count, payload.developed_at, payload.notes,
       payload.location_label, payload.developer, payload.dilution, payload.dev_time, payload.dev_temp,
       payload.push_pull, payload.fixer, payload.photo_flo, COALESCE(payload.is_public, false),
       payload.created_at, payload.updated_at)
    ON CONFLICT (id) DO NOTHING RETURNING sync_revision INTO new_revision;
  ELSE
    UPDATE public.rolls AS r SET
      (name, film_stock_id, camera_id, iso, frame_count, status, loaded_at, lab_at,
       lab_dropoff_id, backed_up_at, backed_up_count, developed_at, notes, location_label,
       developer, dilution, dev_time, dev_temp, push_pull, fixer, photo_flo, is_public, created_at, updated_at) =
      (SELECT v.name, v.film_stock_id, v.camera_id, v.iso, v.frame_count, v.status, v.loaded_at, v.lab_at,
       v.lab_dropoff_id, v.backed_up_at, v.backed_up_count, v.developed_at, v.notes, v.location_label,
       v.developer, v.dilution, v.dev_time, v.dev_temp, v.push_pull, v.fixer, v.photo_flo, v.is_public,
       v.created_at, v.updated_at FROM jsonb_populate_record(r, p_fields) AS v)
    WHERE r.id = p_id AND r.user_id = owner_id AND r.sync_revision = p_expected_revision
      AND r.sync_deleted_at IS NULL
    RETURNING r.sync_revision INTO new_revision;
  END IF;

  IF new_revision IS NULL THEN RETURN jsonb_build_object('status', 'conflict'); END IF;
  RETURN jsonb_build_object('status', 'saved', 'revision', new_revision);
END;
$$;

CREATE OR REPLACE FUNCTION public.guarded_shot_write(p_id text, p_roll_id text, p_expected_revision integer, p_fields jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  owner_id uuid := auth.uid();
  payload public.shots%ROWTYPE;
  new_revision integer;
  allowed constant text[] := ARRAY[
    'frame', 'shutter', 'aperture', 'lighting', 'subject', 'notes', 'location_label',
    'latitude', 'longitude', 'scan_uri', 'timestamp', 'flash', 'filter', 'weather', 'rating', 'tags'
  ];
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_id IS NULL OR btrim(p_id) = '' OR p_roll_id IS NULL OR btrim(p_roll_id) = ''
     OR p_fields IS NULL OR jsonb_typeof(p_fields) <> 'object'
     OR (p_expected_revision IS NOT NULL AND p_expected_revision < 1)
     OR p_fields - allowed <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Invalid frame write arguments' USING ERRCODE = '22023';
  END IF;

  -- The parent must belong to the caller, even when it is publicly readable.
  PERFORM 1 FROM public.rolls WHERE id = p_roll_id AND user_id = owner_id AND sync_deleted_at IS NULL FOR KEY SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'conflict'); END IF;

  IF p_expected_revision IS NULL THEN
    payload := jsonb_populate_record(NULL::public.shots, p_fields);
    INSERT INTO public.shots
      (id, roll_id, user_id, frame, shutter, aperture, lighting, subject, notes, location_label,
       latitude, longitude, scan_uri, "timestamp", flash, filter, weather, rating, tags)
    VALUES
      (p_id, p_roll_id, owner_id, payload.frame, payload.shutter, payload.aperture, payload.lighting,
       payload.subject, payload.notes, payload.location_label, payload.latitude, payload.longitude,
       payload.scan_uri, payload."timestamp", payload.flash, payload.filter, payload.weather, payload.rating, payload.tags)
    ON CONFLICT (id) DO NOTHING RETURNING sync_revision INTO new_revision;
  ELSE
    UPDATE public.shots AS s SET
      (frame, shutter, aperture, lighting, subject, notes, location_label, latitude, longitude,
       scan_uri, "timestamp", flash, filter, weather, rating, tags) =
      (SELECT v.frame, v.shutter, v.aperture, v.lighting, v.subject, v.notes, v.location_label,
       v.latitude, v.longitude, v.scan_uri, v."timestamp", v.flash, v.filter, v.weather, v.rating, v.tags
       FROM jsonb_populate_record(s, p_fields) AS v)
    WHERE s.id = p_id AND s.roll_id = p_roll_id AND s.user_id = owner_id AND s.sync_deleted_at IS NULL
      AND s.sync_revision = p_expected_revision
    RETURNING s.sync_revision INTO new_revision;
  END IF;

  IF new_revision IS NULL THEN RETURN jsonb_build_object('status', 'conflict'); END IF;
  RETURN jsonb_build_object('status', 'saved', 'revision', new_revision);
END;
$$;

ALTER FUNCTION public.guarded_roll_write(text, integer, jsonb) OWNER TO CURRENT_USER;
ALTER FUNCTION public.guarded_shot_write(text, text, integer, jsonb) OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION public.guarded_roll_write(text, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guarded_shot_write(text, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guarded_roll_write(text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guarded_shot_write(text, text, integer, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
