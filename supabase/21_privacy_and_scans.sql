-- v1 privacy and scan storage. Run after 20_roll_expiry.sql, in the Supabase
-- Dashboard → SQL Editor. Safe to re-run.
--
-- 1. Public rolls are off until the social features (v2). A public roll let any
--    signed-in user read its frames, including GPS coordinates and notes, and
--    anyone can sign up. Owners still read their own rows through "own rows".
--    v2 brings sharing back with locations removed (see V2.md).
-- 2. The "scans" bucket is kept private, and the server enforces the same limits
--    as the app (50 MB, images only), so calling the API directly can't skip them.
-- 3. Scans get an UPDATE policy: re-uploading a frame's scan uses upsert, which
--    needs INSERT, SELECT and UPDATE.

BEGIN;

-- ── 1. No public reads of rolls, frames or journals in v1 ───────────────────

DROP POLICY IF EXISTS "rolls_public_read" ON public.rolls;
DROP POLICY IF EXISTS "shots_public_read" ON public.shots;
DROP POLICY IF EXISTS "journals_public_read" ON public.location_journals;

-- ── 2. A private scans bucket with server-side limits ────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'scans') THEN
    RAISE EXCEPTION 'The "scans" bucket does not exist. Create it first (README → Storage setup).';
  END IF;
END;
$$;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 52428800, -- 50 MB, matching MAX_SCAN_MB in src/utils/scanUploadSafety.ts
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/tiff', 'image/heic', 'image/heif']
WHERE id = 'scans';

-- ── 3. Owner-only access to scans, in your own folder ({userId}/…) ───────────

DROP POLICY IF EXISTS "upload own scans" ON storage.objects;
CREATE POLICY "upload own scans" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scans' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "read own scans" ON storage.objects;
CREATE POLICY "read own scans" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'scans' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "update own scans" ON storage.objects;
CREATE POLICY "update own scans" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'scans' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'scans' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "delete own scans" ON storage.objects;
CREATE POLICY "delete own scans" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'scans' AND (storage.foldername(name))[1] = auth.uid()::text);

COMMIT;

-- ── Check the result ─────────────────────────────────────────────────────────
-- Expect: public = false, file_size_limit = 52428800, five image types.
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'scans';
-- Expect four scan policies (upload, read, update, delete), each for "authenticated".
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '% own scans';
-- Expect no rows: nothing on rolls, shots or journals is readable by other users.
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('rolls', 'shots', 'location_journals')
  AND policyname LIKE '%public_read';
