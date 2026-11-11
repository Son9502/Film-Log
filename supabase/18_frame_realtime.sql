-- Live updates for frames as well as rolls, so an edit or scan import on one
-- device shows up on the others within seconds. Run after 15. Safe to re-run.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rolls', 'shots'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;
