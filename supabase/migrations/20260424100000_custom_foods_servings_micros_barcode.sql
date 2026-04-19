-- TestFlight build 9 feedback `AE52_fIRZ-ZIupmoJ8T4yaI` (2026-04-19) —
-- tester comparing Suppr's "Create custom food" form to MyFitnessPal /
-- LoseIt noted four gaps: natural serving size + servings per container,
-- detailed micros (sugar / sat fat / sodium), and a barcode.
--
-- Schema response:
--  - `servings_per_container` — optional numeric; NOT derivable from the
--    existing `servings` JSONB array (which records natural-portion
--    shortcuts like "1 slice = 30 g"). Kept nullable because not every
--    custom food corresponds to a packaged product.
--  - `sugar_g`, `saturated_fat_g`, `sodium_mg` — optional micros matching
--    the MFP/LoseIt label form. Nullable so the project rule "never
--    invent nutrition values" holds — an unknown micro stays unknown.
--  - `barcode` — optional text. Text-only for this pass; the mobile
--    `expo-camera` / `expo-barcode-scanner` integration is a follow-up.
--
-- A partial unique index on `(user_id, barcode) where barcode is not null`
-- stops a single user from registering two custom foods on the same
-- package. Partial so nulls don't collide with each other.
--
-- Idempotent via `add column if not exists` so applying this after a
-- prior partial apply (e.g. a failed `supabase db push --linked`) is a
-- no-op.

alter table public.user_custom_foods
  add column if not exists servings_per_container numeric;

alter table public.user_custom_foods
  add column if not exists sugar_g numeric;

alter table public.user_custom_foods
  add column if not exists saturated_fat_g numeric;

alter table public.user_custom_foods
  add column if not exists sodium_mg numeric;

alter table public.user_custom_foods
  add column if not exists barcode text;

-- Non-negative guards — keep us honest with nutrition plausibility.
-- Wrapped in do-blocks because `add constraint if not exists` doesn't
-- exist on this Postgres version and a naked `add constraint` would
-- fail the second time this migration applied.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_custom_foods_servings_per_container_nonneg'
  ) then
    alter table public.user_custom_foods
      add constraint user_custom_foods_servings_per_container_nonneg
      check (servings_per_container is null or servings_per_container > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_custom_foods_sugar_g_nonneg'
  ) then
    alter table public.user_custom_foods
      add constraint user_custom_foods_sugar_g_nonneg
      check (sugar_g is null or sugar_g >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_custom_foods_saturated_fat_g_nonneg'
  ) then
    alter table public.user_custom_foods
      add constraint user_custom_foods_saturated_fat_g_nonneg
      check (saturated_fat_g is null or saturated_fat_g >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_custom_foods_sodium_mg_nonneg'
  ) then
    alter table public.user_custom_foods
      add constraint user_custom_foods_sodium_mg_nonneg
      check (sodium_mg is null or sodium_mg >= 0);
  end if;
end $$;

-- Partial unique: a user cannot accidentally register two custom foods
-- against the same package. Null barcodes are allowed to repeat — this
-- is the standard "homemade, no barcode" path.
create unique index if not exists user_custom_foods_user_barcode_idx
  on public.user_custom_foods (user_id, barcode)
  where barcode is not null;

NOTIFY pgrst, 'reload schema';
