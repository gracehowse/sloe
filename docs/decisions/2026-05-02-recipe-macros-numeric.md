# Recipe macro columns: INTEGER → NUMERIC(10, 2) (2026-05-02)

**Status:** Resolved.
**Authority:** F-72 (TestFlight Build 41 + web /recipe/new repro).
**Owner:** Grace.
**Migration:** `supabase/migrations/20260508100000_recipes_macros_numeric.sql`.

## Problem

Saving any recipe whose computed-per-serving macros were non-integer
crashed Postgres with:

```
invalid input syntax for type integer: "2.3"
```

Repro: open the mobile create-recipe wizard, add an ingredient that
yields a fractional fat-per-serving (or type `2.3` into the fat
override on Step 4 of the wizard), tap Save. Equivalent on web at
`/recipe/new` via `RecipeUpload.tsx`.

## Reality check

`recipes.{calories,protein,carbs,fat}` and the matching
`recipe_ingredients.{calories,protein,carbs,fat}` columns were
defined as `INTEGER` in the Phase 0 schema. The product had always
exposed 1-decimal precision in the UI and the seeded-recipes backfill
migration (`20260503113000_seeded_recipes_macros_backfill`) explicitly
rounds to 1 decimal — but Postgres rejected those values on insert
because INTEGER only accepts whole numbers.

Mobile partially mitigated for `recipe_ingredients` by `Math.round`-
ing per-line macros before insert (`CreateRecipeWizard.tsx`,
`create-recipe.tsx`). That hid the bug for ingredient rows but ate
decimal precision. The top-level `recipes` row was inserted raw
(per-serving values from `computePerServing`, which already rounds to
1 decimal), and that's where the surface error fires — the integer
column rejects `2.3`.

The other macro columns on the same tables (`fiber_g`, `sugar_g`,
`sodium_mg`) were already `numeric` (added by migration
`20260408143000_add_verified_nutrition_micros`).

## Options considered

1. **Round everything to integers at write time on both surfaces.**
   Cheap, no migration, but loses precision the UI already advertises
   ("7.5 g protein") and creates a 1-line drift between the wizard's
   on-screen macros panel and the persisted row. Rejected.

2. **Widen to FLOAT / REAL.** Postgres permits but the rest of the
   schema standardised on `numeric` for nutrition values
   (`fiber_g`, `sugar_g`, `sodium_mg`, `nutrition_entries.protein` is
   `real`). Mixing float types invites floating-point comparison
   bugs. Rejected.

3. **Widen to NUMERIC(10, 2).** Decimal storage with explicit
   precision. 10 digits, 2 decimals comfortably covers any per-
   serving macro (max ~99,999,999.99 g — recipes will never approach
   this) and 2-decimal precision matches USDA / FatSecret display
   rounding. **Selected.**

## Resolution

Migration `20260508100000_recipes_macros_numeric.sql` widens the
eight affected columns:

```sql
ALTER TABLE public.recipes
  ALTER COLUMN calories TYPE NUMERIC(10, 2) USING calories::numeric,
  ALTER COLUMN protein  TYPE NUMERIC(10, 2) USING protein::numeric,
  ALTER COLUMN carbs    TYPE NUMERIC(10, 2) USING carbs::numeric,
  ALTER COLUMN fat      TYPE NUMERIC(10, 2) USING fat::numeric;

ALTER TABLE public.recipe_ingredients
  ALTER COLUMN calories TYPE NUMERIC(10, 2) USING calories::numeric,
  ALTER COLUMN protein  TYPE NUMERIC(10, 2) USING protein::numeric,
  ALTER COLUMN carbs    TYPE NUMERIC(10, 2) USING carbs::numeric,
  ALTER COLUMN fat      TYPE NUMERIC(10, 2) USING fat::numeric;
```

Followed by a `NOTIFY pgrst, 'reload schema'` so PostgREST picks up
the new column types without waiting for an API container cold start.

## Defensive client rounding

Even with the widened schema, both write surfaces round at the
boundary:

- `roundMacro(value)` — 1 decimal place. Returns 0 for non-finite.
- `roundCalories(value)` — whole kcal. Returns 0 for non-finite.

Both helpers live in `src/lib/recipes/createRecipeWizard.ts` and are
imported by the mobile wizard (`apps/mobile/components/recipe/
CreateRecipeWizard.tsx`) and the web upload form (`src/app/components/
RecipeUpload.tsx`). This ensures:

- The wizard's macro overrides (a user typing `2.345` into fat) are
  collapsed to 1-decimal before write.
- The seeded-recipes backfill rounding matches the wizard rounding
  (no "1.49 vs 1.5" drift between SQL-backfilled rows and rows
  created via the wizard).
- A future code path that bypasses `computePerServing` still rounds
  before hitting Postgres.

## Web vs mobile parity

Web and mobile both use the shared `roundCalories` / `roundMacro`
helpers from `src/lib/recipes/createRecipeWizard.ts`. The mobile
single-screen create form (`apps/mobile/app/create-recipe.tsx`) has
its own per-serving compute that already `Math.round`-s to integers,
so it was never affected by the bug — left untouched to minimise
blast radius.

## Apply path

Per CLAUDE.md project rule:

```
Never apply Supabase migrations via MCP `apply_migration` for files
committed to `supabase/migrations/`.
```

The migration file is staged in this PR. Grace runs
`supabase db push --linked` after merge.

## Reversibility

NUMERIC(10, 2) → INTEGER would silently truncate decimals on existing
rows. Reverting is therefore lossy and is not a sanctioned rollback —
the only safe direction is forward.
