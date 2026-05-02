-- Household-aware meal plan editing (Honeydew plan-realtime parity, 2026-05-02)
--
-- Goal:
--   Close the customer-lens gap raised against PR #39: Honeydew's
--   couples-loop is "plan-then-shop" (real-time on the WEEK, not just
--   the trip to Tesco). Suppr currently has shop-realtime via
--   `shopping_items.household_id`; this migration extends the same
--   pattern to `meal_plan_meals` so two phones editing next week's
--   plan see each other's swaps land in <1s.
--
-- Shape:
--   - `meal_plan_days.household_id` — nullable, denormalised onto the
--     parent row so the day's owner can be flipped when a user joins
--     or leaves a household. Existing per-user days keep
--     `household_id IS NULL` and the legacy "Own plan days" policy
--     continues to apply via the `household_id IS NULL AND user_id =
--     auth.uid()` branch in the new policies below.
--
--   - `meal_plan_meals.household_id` — denormalised again so the
--     Supabase Realtime postgres_changes filter can target this column
--     directly (Realtime filters cannot do JOIN sub-queries; the only
--     reliable way to scope a household subscription is a column on
--     the table the subscription is bound to). Backfilled in step 5
--     from `meal_plan_days.household_id`.
--
-- RLS contract (matches `shopping_items` policy from
-- `20260504100100_household_shopping.sql`):
--   - Per-user rows (household_id IS NULL): only own user_id (or for
--     `meal_plan_meals` the parent day's user_id).
--   - Household rows (household_id IS NOT NULL): every member of that
--     household. The `with check` on INSERT/UPDATE forces the caller
--     to belong to whichever household_id they're stamping.
--
--   `public.auth_household_ids()` (security definer helper, defined in
--   `20260423110000_household_rls_recursion_fix.sql`) resolves the
--   caller's household ids without forming an RLS recursion cycle on
--   `household_members`.
--
-- Real-time:
--   `meal_plan_meals` is added to the `supabase_realtime` publication.
--   Clients subscribe with `household_id=eq.<id>` for households
--   (or `plan_day_id=eq.<id>` for solo, but the helper today uses
--   household-only — solo edits don't need cross-device sync because
--   there's only one device by definition). RLS is re-checked
--   server-side on every payload, so a non-member never sees another
--   household's changes.
--
-- Idempotence:
--   Every statement uses `if not exists` / `drop policy if exists`
--   so the migration can be re-applied on a partially-applied DB.
--
-- Apply path:
--   STAGED ONLY. Per CLAUDE.md, this file must NEVER be applied via
--   MCP `apply_migration` (rewrites schema_migrations.version to
--   wall-clock NOW() and corrupts ordering). Run instead:
--     supabase db push --linked
--   from the repo root after Grace reviews.

-- ────────── 1. Schema ──────────

alter table public.meal_plan_days
  add column if not exists household_id uuid references public.households(id) on delete cascade;

alter table public.meal_plan_meals
  add column if not exists household_id uuid references public.households(id) on delete cascade;

create index if not exists meal_plan_days_household_idx
  on public.meal_plan_days (household_id, day)
  where household_id is not null;

create index if not exists meal_plan_meals_household_idx
  on public.meal_plan_meals (household_id, slot_index)
  where household_id is not null;

-- ────────── 2. Backfill ──────────
--
-- For meals whose parent day already carries a household_id (none
-- today — this is the first migration to introduce the column — but
-- safe under partial re-apply), copy it down. No-op on fresh DBs.

update public.meal_plan_meals m
   set household_id = d.household_id
  from public.meal_plan_days d
 where m.plan_day_id = d.id
   and d.household_id is not null
   and m.household_id is null;

-- ────────── 3. RLS — meal_plan_days ──────────

drop policy if exists "Own plan days" on public.meal_plan_days;
drop policy if exists "household_plan_days_select" on public.meal_plan_days;
drop policy if exists "household_plan_days_insert" on public.meal_plan_days;
drop policy if exists "household_plan_days_update" on public.meal_plan_days;
drop policy if exists "household_plan_days_delete" on public.meal_plan_days;

create policy "household_plan_days_select"
  on public.meal_plan_days for select
  to authenticated
  using (
    (household_id is null and user_id = auth.uid())
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  );

create policy "household_plan_days_insert"
  on public.meal_plan_days for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      household_id is null
      or household_id in (select public.auth_household_ids())
    )
  );

create policy "household_plan_days_update"
  on public.meal_plan_days for update
  to authenticated
  using (
    (household_id is null and user_id = auth.uid())
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  )
  with check (
    (household_id is null and user_id = auth.uid())
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  );

create policy "household_plan_days_delete"
  on public.meal_plan_days for delete
  to authenticated
  using (
    (household_id is null and user_id = auth.uid())
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  );

-- ────────── 4. RLS — meal_plan_meals ──────────
--
-- Legacy policy keyed off the parent day's user_id. Replace with
-- explicit per-action policies that respect the new household scope.
-- Two branches per policy:
--   (a) household_id IS NULL → fall back to the parent day's user_id
--       check (matches the legacy behaviour exactly).
--   (b) household_id IS NOT NULL → caller must be a household member.

drop policy if exists "Own plan meals" on public.meal_plan_meals;
drop policy if exists "household_plan_meals_select" on public.meal_plan_meals;
drop policy if exists "household_plan_meals_insert" on public.meal_plan_meals;
drop policy if exists "household_plan_meals_update" on public.meal_plan_meals;
drop policy if exists "household_plan_meals_delete" on public.meal_plan_meals;

create policy "household_plan_meals_select"
  on public.meal_plan_meals for select
  to authenticated
  using (
    (household_id is null and exists (
      select 1 from public.meal_plan_days d
      where d.id = plan_day_id and d.user_id = auth.uid()
    ))
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  );

create policy "household_plan_meals_insert"
  on public.meal_plan_meals for insert
  to authenticated
  with check (
    (household_id is null and exists (
      select 1 from public.meal_plan_days d
      where d.id = plan_day_id and d.user_id = auth.uid()
    ))
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  );

create policy "household_plan_meals_update"
  on public.meal_plan_meals for update
  to authenticated
  using (
    (household_id is null and exists (
      select 1 from public.meal_plan_days d
      where d.id = plan_day_id and d.user_id = auth.uid()
    ))
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  )
  with check (
    (household_id is null and exists (
      select 1 from public.meal_plan_days d
      where d.id = plan_day_id and d.user_id = auth.uid()
    ))
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  );

create policy "household_plan_meals_delete"
  on public.meal_plan_meals for delete
  to authenticated
  using (
    (household_id is null and exists (
      select 1 from public.meal_plan_days d
      where d.id = plan_day_id and d.user_id = auth.uid()
    ))
    or (household_id is not null and household_id in (select public.auth_household_ids()))
  );

-- ────────── 5. Real-time ──────────
--
-- `supabase_realtime` may not exist on every fresh project. Wrap in
-- a guarded DO block (mirrors `20260504100100_household_shopping.sql`).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'meal_plan_meals'
    ) then
      alter publication supabase_realtime add table public.meal_plan_meals;
    end if;
  end if;
end $$;

NOTIFY pgrst, 'reload schema';
