-- Add missing SELECT policies for food_reports and recipe_plan_add_events when those tables exist.
-- Some environments may not have food_reports yet; skip gracefully.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'food_reports'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'food_reports'
      AND policyname = 'food_reports_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY "food_reports_select_own"
      ON public.food_reports FOR SELECT
      USING (auth.uid() = reporter_id)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'recipe_plan_add_events'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'recipe_plan_add_events'
      AND policyname = 'recipe_plan_add_events_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY "recipe_plan_add_events_select_own"
      ON public.recipe_plan_add_events FOR SELECT
      USING (auth.uid() = user_id)';
  END IF;
END $$;
