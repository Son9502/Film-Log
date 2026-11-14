-- v1 security hardening. Run in Supabase Dashboard → SQL Editor after 05_profiles_avatars.sql.
-- Safe to re-run.

-- ── 1. Private profiles ───────────────────────────────────────────────────────
-- Other users can only read profiles that are public; you can always read your own.

DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read"
  ON public.profiles FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = user_id);

-- ── 2. Remove the README's overlapping walk policies ─────────────────────────
-- Permissive policies are OR-ed together, so these made `walk_reviews` readable
-- by everyone (including signed-out users) and bypassed the stricter policies below.

DROP POLICY IF EXISTS "own walks"      ON public.walks;
DROP POLICY IF EXISTS "read public"    ON public.walks;
DROP POLICY IF EXISTS "own stops"      ON public.walk_stops;
DROP POLICY IF EXISTS "read pub stops" ON public.walk_stops;
DROP POLICY IF EXISTS "own completions" ON public.walk_completions;
DROP POLICY IF EXISTS "own reviews"    ON public.walk_reviews;
DROP POLICY IF EXISTS "read reviews"   ON public.walk_reviews;

-- Re-create the intended policy set (same as 01–03) so this script works
-- whether or not 01_walks.sql was ever run on this project.

DROP POLICY IF EXISTS "walks_select" ON public.walks;
CREATE POLICY "walks_select"
  ON public.walks FOR SELECT TO authenticated
  USING (is_public = true OR auth.uid() = created_by_user_id);

DROP POLICY IF EXISTS "walks_insert" ON public.walks;
CREATE POLICY "walks_insert"
  ON public.walks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

DROP POLICY IF EXISTS "walks_update" ON public.walks;
CREATE POLICY "walks_update"
  ON public.walks FOR UPDATE TO authenticated
  USING (auth.uid() = created_by_user_id)
  WITH CHECK (auth.uid() = created_by_user_id);

DROP POLICY IF EXISTS "walks_delete" ON public.walks;
CREATE POLICY "walks_delete"
  ON public.walks FOR DELETE TO authenticated
  USING (auth.uid() = created_by_user_id);

DROP POLICY IF EXISTS "walk_stops_select" ON public.walk_stops;
CREATE POLICY "walk_stops_select"
  ON public.walk_stops FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_stops.walk_id
        AND (walks.is_public = true OR walks.created_by_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "walk_stops_insert" ON public.walk_stops;
CREATE POLICY "walk_stops_insert"
  ON public.walk_stops FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "walk_stops_update" ON public.walk_stops;
CREATE POLICY "walk_stops_update"
  ON public.walk_stops FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_stops.walk_id AND walks.created_by_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "walk_stops_delete" ON public.walk_stops;
CREATE POLICY "walk_stops_delete"
  ON public.walk_stops FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_stops.walk_id AND walks.created_by_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "walk_completions_select" ON public.walk_completions;
CREATE POLICY "walk_completions_select"
  ON public.walk_completions FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_completions.walk_id AND walks.created_by_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "walk_completions_insert" ON public.walk_completions;
CREATE POLICY "walk_completions_insert"
  ON public.walk_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "walk_completions_delete" ON public.walk_completions;
CREATE POLICY "walk_completions_delete"
  ON public.walk_completions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "walk_reviews_select" ON public.walk_reviews;
CREATE POLICY "walk_reviews_select"
  ON public.walk_reviews FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.walks
      WHERE walks.id = walk_reviews.walk_id
        AND (walks.created_by_user_id = auth.uid() OR walks.is_public = true)
    )
  );

DROP POLICY IF EXISTS "walk_reviews_insert" ON public.walk_reviews;
CREATE POLICY "walk_reviews_insert"
  ON public.walk_reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "walk_reviews_update" ON public.walk_reviews;
CREATE POLICY "walk_reviews_update"
  ON public.walk_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "walk_reviews_delete" ON public.walk_reviews;
CREATE POLICY "walk_reviews_delete"
  ON public.walk_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ── 3. Counters maintained by triggers, not client-callable RPCs ──────────────
-- The old RPCs let any signed-in user change any walk's counters.

DROP FUNCTION IF EXISTS public.increment_walk_completion(TEXT);
DROP FUNCTION IF EXISTS public.decrement_walk_completion(TEXT);
DROP FUNCTION IF EXISTS public.refresh_walk_avg_rating(TEXT);

CREATE OR REPLACE FUNCTION public.sync_walk_completion_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target TEXT := COALESCE(NEW.walk_id, OLD.walk_id);
BEGIN
  UPDATE public.walks
  SET completion_count = (SELECT COUNT(*) FROM public.walk_completions WHERE walk_id = target)
  WHERE id = target;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_walk_avg_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target TEXT := COALESCE(NEW.walk_id, OLD.walk_id);
BEGIN
  UPDATE public.walks
  SET avg_rating = (SELECT AVG(rating)::FLOAT FROM public.walk_reviews WHERE walk_id = target)
  WHERE id = target;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_walk_completion_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_walk_avg_rating()       FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS walk_completions_count ON public.walk_completions;
CREATE TRIGGER walk_completions_count
  AFTER INSERT OR DELETE ON public.walk_completions
  FOR EACH ROW EXECUTE FUNCTION public.sync_walk_completion_count();

DROP TRIGGER IF EXISTS walk_reviews_avg ON public.walk_reviews;
CREATE TRIGGER walk_reviews_avg
  AFTER INSERT OR UPDATE OR DELETE ON public.walk_reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_walk_avg_rating();

-- Direct client writes to the counters and the featured flag are ignored.
-- The triggers above run as the function owner, and the SQL editor runs as postgres,
-- so those can still set them (e.g. to feature a walk).
CREATE OR REPLACE FUNCTION public.protect_walk_server_fields()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.completion_count := 0;
      NEW.avg_rating := NULL;
      NEW.is_featured := false;
    ELSE
      NEW.completion_count := OLD.completion_count;
      NEW.avg_rating := OLD.avg_rating;
      NEW.is_featured := OLD.is_featured;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS walks_protect_server_fields ON public.walks;
CREATE TRIGGER walks_protect_server_fields
  BEFORE INSERT OR UPDATE ON public.walks
  FOR EACH ROW EXECUTE FUNCTION public.protect_walk_server_fields();

-- Backfill counters from the real data.
UPDATE public.walks w
SET completion_count = (SELECT COUNT(*) FROM public.walk_completions c WHERE c.walk_id = w.id),
    avg_rating       = (SELECT AVG(rating)::FLOAT FROM public.walk_reviews r WHERE r.walk_id = w.id);

-- ── 4. Function hardening ─────────────────────────────────────────────────────

ALTER FUNCTION public.set_updated_at() SET search_path = public;
