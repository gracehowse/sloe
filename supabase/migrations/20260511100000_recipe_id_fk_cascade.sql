-- Phase 1 of the recipe FK cascade refactor.
--
-- Plan doc: docs/planning/schema-refactor-plan-recipe-fk-cascade.md
--
-- Why this migration exists:
-- The "Defaults to recipes that don't exist" tester report (closed
-- client-side in PR #187 with the "Recipe removed" badge) is a
-- symptom of two missing constraints:
--
--   1. `meal_plan_meals.recipe_id` is `text`, with no FK against
--      `recipes.id`. When a recipe is deleted from the library, the
--      plan row keeps a stale text id and the meal card half-renders
--      (web disables click; mobile drops to no-image fallback).
--
--   2. `nutrition_entries` has no `recipe_id` column at all. The
--      `source_id text` column (migration 20260421200050) is used
--      for dedup, sometimes holds a recipe UUID, but is not declared
--      or constrained as a recipe reference — so journal rows can
--      never be reverse-linked to a deleted recipe either.
--
-- This migration:
--   - Casts `meal_plan_meals.recipe_id` from text → uuid with a real
--     FK against `recipes(id) ON DELETE SET NULL`. Pre-cast we scrub
--     any non-UUID strings (legacy plans pre-T7) to NULL so the
--     `::uuid` cast can never fail. SET NULL is the call (not CASCADE)
--     so a deleted recipe leaves the planned slot intact with title +
--     macros — the user just loses the link to the recipe detail.
--     Same posture as `household_meals.recipe_id` (migration
--     20260420100000).
--
--   - Adds `nutrition_entries.recipe_id uuid` with the same FK +
--     SET NULL. No backfill — the historical `source_id` mapping is
--     too inconsistent for an automatic backfill to be safe; clients
--     start populating the new column for new logs (Phase 2).
--
--   - Updates the `save_meal_plan` RPC to cast `recipe_id` from JSON
--     text → uuid via a per-row EXCEPTION block that swallows
--     malformed inputs and stores NULL rather than aborting the
--     entire plan save. All existing auth + day-range checks are
--     preserved verbatim from the prior RPC body.
--
-- Phase 2 (separate PR) wires client `nutrition_entries` insert
-- sites to populate the new `recipe_id` column.
-- Phase 3 (separate PR) deletes the `phase1LegacyJsonb.ts` shim.
--
-- RLS is unchanged across both tables — existing policies key off
-- `user_id` / `plan_day_id`, neither of which moves.
--
-- Apply via `supabase db push --linked` (NOT MCP apply_migration).

begin;

-- ============================================================
-- 1. meal_plan_meals.recipe_id: text → uuid + FK
-- ============================================================

-- Step 1a — scrub non-UUID values. Anything that doesn't match the
-- canonical 8-4-4-4-12 hex shape becomes NULL. Without this the
-- `::uuid` cast in step 1c would raise 22P02 and abort the whole
-- migration.
update public.meal_plan_meals
   set recipe_id = null
 where recipe_id is not null
   and recipe_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 1a' — scrub orphan UUIDs. Some plan rows carry a syntactically
-- valid UUID that points at a recipe that has since been deleted from
-- the library — exactly the "Defaults to recipes that don't exist"
-- bug. Without this scrub the FK add in step 1b would fail mid-
-- migration with 23503 (foreign_key_violation) on the backfill.
-- PR #187's "Recipe removed" client badge surfaced these rows; this
-- step now resolves them at the DB layer so future deletes can't
-- recreate the orphan state.
update public.meal_plan_meals
   set recipe_id = null
 where recipe_id is not null
   and not exists (
     select 1 from public.recipes r where r.id = recipe_id::uuid
   );

-- Step 1b — add the new typed column, FK with SET NULL.
alter table public.meal_plan_meals
  add column if not exists recipe_id_uuid uuid
    references public.recipes(id) on delete set null;

-- Step 1c — backfill from the text column. Safe: step 1a guarantees
-- only valid UUIDs and step 1a' guarantees those UUIDs resolve to
-- live recipes.
update public.meal_plan_meals
   set recipe_id_uuid = recipe_id::uuid
 where recipe_id is not null
   and recipe_id_uuid is null;

-- Step 1d — drop old column, rename new one into its place. ALTER
-- COLUMN ... TYPE would be cleaner but introduces a temporary state
-- where the column exists with no FK; the add-then-rename pattern
-- gives us a clean atomic swap.
alter table public.meal_plan_meals drop column recipe_id;
alter table public.meal_plan_meals rename column recipe_id_uuid to recipe_id;

-- Index for "all plans referencing recipe X" — used implicitly by
-- the FK constraint when a recipe is deleted (Postgres needs to
-- find matching rows to NULL out). Partial index on non-null since
-- placeholder slots are common and don't need indexing.
create index if not exists meal_plan_meals_recipe_id_idx
  on public.meal_plan_meals (recipe_id)
  where recipe_id is not null;

-- ============================================================
-- 2. nutrition_entries.recipe_id: new column + FK
-- ============================================================

alter table public.nutrition_entries
  add column if not exists recipe_id uuid
    references public.recipes(id) on delete set null;

create index if not exists nutrition_entries_recipe_id_idx
  on public.nutrition_entries (recipe_id)
  where recipe_id is not null;

-- ============================================================
-- 3. save_meal_plan RPC: graceful uuid cast on recipe_id
-- ============================================================
--
-- Preserves the T15 (2026-04-24) atomic-replace semantics, the
-- `42501` unauth error, and the `22023` day-range check from the
-- prior RPC. The only behaviour change is per-row recipe_id
-- handling:
--
--   pre:   stored `m->>'recipe_id'` as raw text (column was text)
--   post:  per-row EXCEPTION block casts to uuid; malformed input
--          stores NULL rather than aborting the whole plan save
--
-- The meals INSERT moves from a SET subquery to a FOR loop because
-- we need the EXCEPTION block per row.

create or replace function public.save_meal_plan(
  p_slot_id text,
  p_start_date date,
  p_plan jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_day_record jsonb;
  v_meal_record jsonb;
  v_day_id uuid;
  v_day_num int;
  v_recipe_id_text text;
  v_recipe_id_uuid uuid;
begin
  -- Reject unauthenticated callers immediately. RLS would reject the
  -- writes anyway; this is a clearer error.
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'save_meal_plan: not authenticated' using errcode = '42501';
  end if;

  -- Replace all meal_plan_days rows for this user+slot. Cascades to
  -- meal_plan_meals via the FK on plan_day_id.
  delete from public.meal_plan_days
    where user_id = v_user_id and slot_id = p_slot_id;

  -- An empty / null plan acts as a "clear" operation — the DELETE
  -- above is sufficient.
  if p_plan is null or jsonb_typeof(p_plan) <> 'array' then
    return;
  end if;

  -- Iterate plan days. Each iteration inserts the day row + (if
  -- meals[] is present) the meals for that day. The whole loop runs
  -- inside the function's implicit statement transaction, so a
  -- partial write — e.g. day 4 fails — rolls back days 1..3 too.
  for v_day_record in
    select value from jsonb_array_elements(p_plan) as t(value)
  loop
    v_day_num := (v_day_record->>'day')::int;
    if v_day_num is null or v_day_num < 1 or v_day_num > 7 then
      raise exception 'save_meal_plan: day must be in 1..7 (got %)', v_day_num
        using errcode = '22023';
    end if;

    insert into public.meal_plan_days (user_id, slot_id, day, start_date)
      values (v_user_id, p_slot_id, v_day_num, p_start_date)
      returning id into v_day_id;

    if v_day_record->'meals' is not null
       and jsonb_typeof(v_day_record->'meals') = 'array'
    then
      for v_meal_record in
        select value from jsonb_array_elements(v_day_record->'meals') as t(value)
      loop
        -- Phase 1 (2026-05-11): per-row uuid cast with a graceful
        -- fallback. Pre-cast the column was text and stored the raw
        -- string; post-cast we need a real uuid or NULL. A malformed
        -- string (legacy build, drift) becomes NULL rather than
        -- aborting the whole plan save.
        v_recipe_id_text := v_meal_record->>'recipe_id';
        v_recipe_id_uuid := null;
        if v_recipe_id_text is not null and v_recipe_id_text <> '' then
          begin
            v_recipe_id_uuid := v_recipe_id_text::uuid;
          exception when invalid_text_representation then
            v_recipe_id_uuid := null;
          end;
        end if;

        insert into public.meal_plan_meals (
          plan_day_id, slot_index, name, recipe_title, recipe_id,
          calories, protein, carbs, fat,
          portion_multiplier, is_placeholder
        )
        values (
          v_day_id,
          coalesce(nullif(v_meal_record->>'slot_index', '')::int, 0),
          coalesce(v_meal_record->>'name', ''),
          coalesce(v_meal_record->>'recipe_title', ''),
          v_recipe_id_uuid,
          coalesce(nullif(v_meal_record->>'calories', '')::int, 0),
          coalesce(nullif(v_meal_record->>'protein', '')::real, 0),
          coalesce(nullif(v_meal_record->>'carbs', '')::real, 0),
          coalesce(nullif(v_meal_record->>'fat', '')::real, 0),
          coalesce(nullif(v_meal_record->>'portion_multiplier', '')::real, 1),
          coalesce(nullif(v_meal_record->>'is_placeholder', '')::boolean, false)
        );
      end loop;
    end if;
  end loop;
end;
$$;

comment on function public.save_meal_plan(text, date, jsonb) is
  'T15 (2026-04-24): atomic plan replace. Phase 1 of recipe FK cascade refactor (2026-05-11): recipe_id is now uuid with FK against recipes.id ON DELETE SET NULL. RPC casts per-row text → uuid with graceful fallback to NULL on malformed input. See docs/planning/schema-refactor-plan-recipe-fk-cascade.md.';

-- Re-grant execute (idempotent — was already granted by the prior
-- migration, but `create or replace function` drops grants on some
-- Postgres versions).
grant execute on function public.save_meal_plan(text, date, jsonb) to authenticated;

commit;
