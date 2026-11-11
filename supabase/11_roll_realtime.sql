-- Enable notifications for newly created rolls. Safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rolls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rolls;
  END IF;
END
$$;
