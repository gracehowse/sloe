-- Add missing SELECT policies for food_reports and recipe_plan_add_events.
-- Both tables had INSERT-only policies; users could not read their own rows.

-- food_reports: users can read their own reports
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'food_reports'
      and policyname = 'food_reports_select_own'
  ) then
    create policy "food_reports_select_own"
    on public.food_reports for select
    using (auth.uid() = reporter_id);
  end if;
end $$;

-- recipe_plan_add_events: users can read their own events
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'recipe_plan_add_events'
      and policyname = 'recipe_plan_add_events_select_own'
  ) then
    create policy "recipe_plan_add_events_select_own"
    on public.recipe_plan_add_events for select
    using (auth.uid() = user_id);
  end if;
end $$;
