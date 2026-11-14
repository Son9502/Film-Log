-- Chemical sets and development batches. Run in Supabase Dashboard → SQL Editor after 09_scan_backup.sql.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.chemical_sets (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  process         TEXT NOT NULL,
  chemistry_id    TEXT NOT NULL,
  chemistry_name  TEXT NOT NULL,
  dilution        TEXT,
  volume_ml       INTEGER CHECK (volume_ml IS NULL OR volume_ml > 0),
  mixed_at        TEXT NOT NULL,
  capacity_rolls  INTEGER CHECK (capacity_rolls IS NULL OR capacity_rolls > 0),
  shelf_life_days INTEGER CHECK (shelf_life_days IS NULL OR shelf_life_days > 0),
  rolls_used      INTEGER NOT NULL DEFAULT 0 CHECK (rolls_used >= 0),
  notes           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.dev_batches (
  id               TEXT PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chemical_set_id  TEXT NOT NULL,
  process          TEXT NOT NULL,
  temp_c           NUMERIC(5, 2) NOT NULL,
  time_seconds     INTEGER NOT NULL CHECK (time_seconds > 0),
  developed_at     TEXT NOT NULL,
  roll_ids         TEXT[] NOT NULL DEFAULT '{}',
  notes            TEXT,
  created_at       TEXT NOT NULL
);

ALTER TABLE public.chemical_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chemical_sets_own" ON public.chemical_sets;
CREATE POLICY "chemical_sets_own"
  ON public.chemical_sets FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dev_batches_own" ON public.dev_batches;
CREATE POLICY "dev_batches_own"
  ON public.dev_batches FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
