-- Expired film: each roll keeps its film's expiry date and the extra exposure given
-- for the film's age, so development isn't treated as a pull. Run after
-- 14_guarded_roll_writes.sql; this replaces guarded_roll_write with a version that
-- accepts the two new fields. Until it runs, rolls without expiry details still
-- sync, and rolls with them stay on the device. Safe to re-run.

BEGIN;

ALTER TABLE public.rolls ADD COLUMN IF NOT EXISTS expires_at TEXT;
ALTER TABLE public.rolls ADD COLUMN IF NOT EXISTS expiry_comp_stops NUMERIC(4,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rolls_expiry_comp_stops_check') THEN
    ALTER TABLE public.rolls
      ADD CONSTRAINT rolls_expiry_comp_stops_check
      CHECK (expiry_comp_stops IS NULL OR (expiry_comp_stops >= 0 AND expiry_comp_stops <= 5));
  END IF;
END
$$;

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
    'push_pull', 'fixer', 'photo_flo', 'expires_at', 'expiry_comp_stops',
    'is_public', 'created_at', 'updated_at'
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
       photo_flo, expires_at, expiry_comp_stops, is_public, created_at, updated_at)
    VALUES
      (p_id, owner_id, payload.name, payload.film_stock_id, payload.camera_id, payload.iso,
       payload.frame_count, payload.status, payload.loaded_at, payload.lab_at, payload.lab_dropoff_id,
       payload.backed_up_at, payload.backed_up_count, payload.developed_at, payload.notes,
       payload.location_label, payload.developer, payload.dilution, payload.dev_time, payload.dev_temp,
       payload.push_pull, payload.fixer, payload.photo_flo, payload.expires_at, payload.expiry_comp_stops,
       COALESCE(payload.is_public, false), payload.created_at, payload.updated_at)
    ON CONFLICT (id) DO NOTHING RETURNING sync_revision INTO new_revision;
  ELSE
    UPDATE public.rolls AS r SET
      (name, film_stock_id, camera_id, iso, frame_count, status, loaded_at, lab_at,
       lab_dropoff_id, backed_up_at, backed_up_count, developed_at, notes, location_label,
       developer, dilution, dev_time, dev_temp, push_pull, fixer, photo_flo,
       expires_at, expiry_comp_stops, is_public, created_at, updated_at) =
      (SELECT v.name, v.film_stock_id, v.camera_id, v.iso, v.frame_count, v.status, v.loaded_at, v.lab_at,
       v.lab_dropoff_id, v.backed_up_at, v.backed_up_count, v.developed_at, v.notes, v.location_label,
       v.developer, v.dilution, v.dev_time, v.dev_temp, v.push_pull, v.fixer, v.photo_flo,
       v.expires_at, v.expiry_comp_stops, v.is_public, v.created_at, v.updated_at
       FROM jsonb_populate_record(r, p_fields) AS v)
    WHERE r.id = p_id AND r.user_id = owner_id AND r.sync_revision = p_expected_revision
      AND r.sync_deleted_at IS NULL
    RETURNING r.sync_revision INTO new_revision;
  END IF;

  IF new_revision IS NULL THEN RETURN jsonb_build_object('status', 'conflict'); END IF;
  RETURN jsonb_build_object('status', 'saved', 'revision', new_revision);
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
