-- F-28 (2026-04-21) follow-up — extend user_foods with micro corrections.
-- TestFlight AJlhpO020UK-: "you should be able to correct the full nutrition
-- label not just key macros". Fiber was already on the table (F-28 exposed it
-- in the form); this migration adds sugar, sodium, and saturated fat so the
-- correction UI can round out the common nutrition-label block.
--
-- Conventions:
--   * grams for mass nutrients (sugar_g, saturated_fat_g) — matches fat/carbs.
--   * milligrams for sodium (sodium_mg) — matches the nutrition_entries /
--     nutrition_micros convention (see src/lib/nutrition/microKeys.ts) and
--     the unit users actually see on packaging.
--   * All nullable + default 0 so existing inserts and lookups are unaffected.
--   * No RLS policy change — inherits the existing select/insert/update
--     policies from 20260414180000_create_user_foods_table.sql.
--
-- Web parity: the correction-form UI is mobile-only today; the columns are
-- still populated on the shared supabase table so a future web correction
-- surface reads the same data.

alter table public.user_foods
  add column if not exists sugar_g numeric default 0,
  add column if not exists sodium_mg numeric default 0,
  add column if not exists saturated_fat_g numeric default 0;

comment on column public.user_foods.sugar_g is 'Sugar in grams per 100 g (same basis as other macros).';
comment on column public.user_foods.sodium_mg is 'Sodium in milligrams per 100 g (packaging-label unit; matches nutrition_micros sodiumMg).';
comment on column public.user_foods.saturated_fat_g is 'Saturated fat in grams per 100 g (subset of fat; matches nutrition_micros saturatedFatG).';
