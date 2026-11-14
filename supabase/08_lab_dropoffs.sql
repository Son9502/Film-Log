-- Lab drop-offs. Run in Supabase Dashboard → SQL Editor after 07_film_purchases.sql.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.lab_dropoffs (
  id                 TEXT PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lab_name           TEXT NOT NULL,
  dropped_off_at     TEXT NOT NULL,
  expected_pickup_at TEXT,
  picked_up_at       TEXT,
  cost               NUMERIC(10, 2) CHECK (cost IS NULL OR cost >= 0),
  lab_develops       BOOLEAN NOT NULL DEFAULT true,
  lab_scans          BOOLEAN NOT NULL DEFAULT false,
  notes              TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

ALTER TABLE public.lab_dropoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lab_dropoffs_own" ON public.lab_dropoffs;
CREATE POLICY "lab_dropoffs_own"
  ON public.lab_dropoffs FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- A roll points at its drop-off (no FK: rolls and drop-offs upload in parallel).
ALTER TABLE public.rolls ADD COLUMN IF NOT EXISTS lab_dropoff_id TEXT;

NOTIFY pgrst, 'reload schema';
