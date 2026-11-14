-- Batch details (fixer, wetting agent, working-solution volume) and a per-roll
-- concentrate minimum on chemical sets. Run after 10_chemical_sets_batches.sql.
-- Safe to re-run.

ALTER TABLE public.dev_batches ADD COLUMN IF NOT EXISTS fixer TEXT;
ALTER TABLE public.dev_batches ADD COLUMN IF NOT EXISTS wetting_agent BOOLEAN;
ALTER TABLE public.dev_batches ADD COLUMN IF NOT EXISTS solution_ml INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dev_batches_solution_ml_check') THEN
    ALTER TABLE public.dev_batches
      ADD CONSTRAINT dev_batches_solution_ml_check CHECK (solution_ml IS NULL OR solution_ml > 0);
  END IF;
END;
$$;

ALTER TABLE public.chemical_sets ADD COLUMN IF NOT EXISTS min_stock_ml_per_roll NUMERIC(6, 1);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chemical_sets_min_stock_check') THEN
    ALTER TABLE public.chemical_sets
      ADD CONSTRAINT chemical_sets_min_stock_check CHECK (min_stock_ml_per_roll IS NULL OR min_stock_ml_per_roll > 0);
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
