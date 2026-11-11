-- Location journals (notes per location label). The app has always used this
-- table, but it was only ever described in the README, never in a script.
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.location_journals (
  id             TEXT PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_label TEXT NOT NULL,
  body           TEXT,
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS location_journals_user_idx ON public.location_journals (user_id);

ALTER TABLE public.location_journals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own rows" ON public.location_journals;
DROP POLICY IF EXISTS "location_journals_own" ON public.location_journals;
CREATE POLICY "location_journals_own"
  ON public.location_journals FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Make PostgREST see the new table immediately (fixes PGRST205 "schema cache").
NOTIFY pgrst, 'reload schema';
