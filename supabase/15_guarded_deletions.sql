-- Roll/frame sync, step 3 of 3: revision-checked deletes with tombstones.
-- Deleted rolls and frames are kept as hidden tombstones so other devices learn
-- about the deletion instead of re-uploading the record. Scan files are removed
-- by the app only after the guarded delete succeeds.
-- Run after 13 and 14. Safe to re-run.

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

DROP POLICY IF EXISTS sync_hide_deleted ON public.rolls;
CREATE POLICY sync_hide_deleted ON public.rolls AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING (sync_deleted_at IS NULL);
DROP POLICY IF EXISTS sync_hide_deleted ON public.shots;
CREATE POLICY sync_hide_deleted ON public.shots AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING (sync_deleted_at IS NULL);

CREATE OR REPLACE FUNCTION public.guarded_roll_delete(p_id text, p_expected_revision integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  owner_id uuid := auth.uid();
  current_revision integer;
  new_revision integer;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_id IS NULL OR btrim(p_id) = '' OR p_expected_revision IS NULL OR p_expected_revision < 1 THEN
    RAISE EXCEPTION 'Invalid roll deletion arguments' USING ERRCODE = '22023';
  END IF;

  SELECT sync_revision INTO current_revision FROM public.rolls
  WHERE id = p_id AND user_id = owner_id AND sync_deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR current_revision <> p_expected_revision THEN
    RETURN jsonb_build_object('status', 'conflict');
  END IF;
  IF EXISTS (SELECT 1 FROM public.shots WHERE roll_id = p_id AND sync_deleted_at IS NULL) THEN
    RETURN jsonb_build_object('status', 'has_frames');
  END IF;

  UPDATE public.rolls SET sync_deleted_at = clock_timestamp()
  WHERE id = p_id RETURNING sync_revision INTO new_revision;
  RETURN jsonb_build_object('status', 'deleted', 'revision', new_revision);
END;
$$;

CREATE OR REPLACE FUNCTION public.guarded_shot_delete(p_id text, p_roll_id text, p_expected_revision integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  owner_id uuid := auth.uid();
  new_revision integer;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_id IS NULL OR btrim(p_id) = '' OR p_roll_id IS NULL OR btrim(p_roll_id) = ''
     OR p_expected_revision IS NULL OR p_expected_revision < 1 THEN
    RAISE EXCEPTION 'Invalid frame deletion arguments' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.rolls
  WHERE id = p_roll_id AND user_id = owner_id AND sync_deleted_at IS NULL FOR KEY SHARE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'conflict'); END IF;

  UPDATE public.shots SET sync_deleted_at = clock_timestamp()
  WHERE id = p_id AND roll_id = p_roll_id AND user_id = owner_id
    AND sync_revision = p_expected_revision AND sync_deleted_at IS NULL
  RETURNING sync_revision INTO new_revision;
  IF new_revision IS NULL THEN RETURN jsonb_build_object('status', 'conflict'); END IF;
  RETURN jsonb_build_object('status', 'deleted', 'revision', new_revision);
END;
$$;

CREATE OR REPLACE FUNCTION public.roll_sync_tombstones()
RETURNS TABLE (kind text, id text, roll_id text, revision integer, deleted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  owner_id uuid := auth.uid();
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  RETURN QUERY
    SELECT 'roll'::text, r.id, r.id, r.sync_revision, r.sync_deleted_at
    FROM public.rolls r WHERE r.user_id = owner_id AND r.sync_deleted_at IS NOT NULL
    UNION ALL
    SELECT 'frame'::text, s.id, s.roll_id, s.sync_revision, s.sync_deleted_at
    FROM public.shots s WHERE s.user_id = owner_id AND s.sync_deleted_at IS NOT NULL;
END;
$$;

ALTER FUNCTION public.guarded_roll_delete(text, integer) OWNER TO CURRENT_USER;
ALTER FUNCTION public.guarded_shot_delete(text, text, integer) OWNER TO CURRENT_USER;
ALTER FUNCTION public.roll_sync_tombstones() OWNER TO CURRENT_USER;
REVOKE ALL ON FUNCTION public.guarded_roll_delete(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guarded_shot_delete(text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roll_sync_tombstones() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guarded_roll_delete(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.guarded_shot_delete(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.roll_sync_tombstones() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
