-- Restore optional shot metadata columns expected by the app. Safe to re-run.
ALTER TABLE public.shots ADD COLUMN IF NOT EXISTS "timestamp" TEXT;
ALTER TABLE public.shots ADD COLUMN IF NOT EXISTS flash BOOLEAN;
ALTER TABLE public.shots ADD COLUMN IF NOT EXISTS filter TEXT;
ALTER TABLE public.shots ADD COLUMN IF NOT EXISTS weather TEXT;
ALTER TABLE public.shots ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE public.shots ADD COLUMN IF NOT EXISTS tags TEXT;

NOTIFY pgrst, 'reload schema';
