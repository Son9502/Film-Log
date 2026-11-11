-- Film inventory. Run in Supabase Dashboard → SQL Editor after 06_security_hardening.sql.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.film_purchases (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  film_stock_id   TEXT NOT NULL,
  quantity        INT NOT NULL CHECK (quantity > 0),
  quantity_loaded INT NOT NULL DEFAULT 0 CHECK (quantity_loaded >= 0),
  price           NUMERIC(10, 2) CHECK (price IS NULL OR price >= 0),
  purchased_at    TEXT NOT NULL,
  expires_at      TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  CHECK (quantity_loaded <= quantity)
);

ALTER TABLE public.film_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "film_purchases_own" ON public.film_purchases;
CREATE POLICY "film_purchases_own"
  ON public.film_purchases FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
