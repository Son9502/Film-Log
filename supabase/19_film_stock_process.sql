-- How each custom film stock is developed (B&W, C-41, E-6, ECN-2), so a batch only
-- offers rolls that its chemistry can develop. Optional: without it the app keeps the
-- process on the device only. Safe to re-run.
ALTER TABLE public.film_stocks ADD COLUMN IF NOT EXISTS process text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'film_stocks_process_check') THEN
    ALTER TABLE public.film_stocks
      ADD CONSTRAINT film_stocks_process_check
      CHECK (process IS NULL OR process IN ('B&W', 'C-41', 'E-6', 'ECN-2'));
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
