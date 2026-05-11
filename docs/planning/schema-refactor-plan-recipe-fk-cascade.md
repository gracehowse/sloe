# Schema refactor: recipe FK cascade on `meal_plan_meals` and `nutrition_entries`

**Created:** 2026-05-10
**Author:** product-lead / planning agent
**Status:** Ready for Phase 1
**Estimated total effort:** 10–14 hours across 3 PRs

---

## Correction to the brief

The brief assumed `meal_plans.plan` (JSONB) and `nutrition_journals.by_day` (JSONB) still exist and need to be extracted into relational tables.

They do not exist. Migration `20260413100000_relational_user_data.sql` already performed that extraction, and `20260421200040_drop_legacy_tables.sql` dropped the legacy tables. `meal_plan_days`, `meal_plan_meals`, and `nutrition_entries` are already the sole source of truth in production.

The actual problem — orphan `recipe_id` values — is real and unsolved. The root cause is:

- `meal_plan_meals.recipe_id` is `text`, not `uuid`. It has no FK constraint against `recipes.id`. A recipe deletion leaves stale text IDs in every planned meal row that referenced it. The DB cannot enforce integrity.
- `nutrition_entries` has no `recipe_id` column at all. It has `source_id text` (opaque dedup key, see migration `20260421200050`), which is not typed as a recipe reference and has no FK.

The client-side "Recipe removed" badge in PR #187 is a symptom of the missing FK on `meal_plan_meals.recipe_id`. Making orphan `recipe_id` values impossible at the DB level is what eliminates that workaround.

This plan addresses both columns. The JSONB dual-write phasing from the original brief is not applicable — that migration is complete. Phases here are leaner.

---

## 1. Blast radius: every site that reads or writes the affected columns

### 1a. `meal_plan_meals.recipe_id` (currently `text | null`)

**Writes** (all go through the `save_meal_plan` RPC, which receives `recipe_id` as a JSON string field and passes it via `m->>'recipe_id'`):

| File | Line | Direction | Notes |
|---|---|---|---|
| `supabase/migrations/20260503100400_save_meal_plan_rpc.sql` | 113 | write | Core RPC: `m->>'recipe_id'` — currently stored as-is, no cast |
| `apps/mobile/app/(tabs)/planner.tsx` | 562 | write | `recipe_id: m.recipeId ?? null` → RPC payload |
| `apps/mobile/app/(tabs)/planner.tsx` | 1542 | write | Same pattern, regenerate path |
| `src/context/AppDataContext.tsx` | 1376 | write | Web plan save via same RPC |
| `src/lib/onboarding/onboardingFirstWeek.ts` | 175 | write | Onboarding seed plan via RPC |

**Reads:**

| File | Line | Direction | Notes |
|---|---|---|---|
| `apps/mobile/app/(tabs)/index.tsx` | 3660 | read | Selects `recipe_id` for `logPlannedMealWithPortion` |
| `apps/mobile/app/(tabs)/index.tsx` | 3685 | read | Maps `recipe_id` onto `plannedMeals` state |
| `apps/mobile/app/(tabs)/planner.tsx` | 1109 | read | Plan load — does NOT select `recipe_id` (macros only) |
| `src/context/AppDataContext.tsx` | 734–735 | read | Web plan load — does NOT select `recipe_id` |
| `apps/mobile/app/shopping.tsx` | 182–186 | read | Reads `recipe_id` from `meal_plan_meals` to query `recipe_ingredients` |

**Indirect — uses `recipe_id` value from state:**

| File | Line | Notes |
|---|---|---|
| `apps/mobile/app/(tabs)/index.tsx` | 4229 | `pm.recipe_id` passed to `fetchPlannedMealMicros` |
| `src/lib/planning/plannedMealMicros.ts` | — | Receives `recipe_id`, queries `recipes` |
| `src/lib/nutrition/planTemplates.ts` | 102 | `meal.recipeId` carried into template JSONB |

### 1b. `nutrition_entries.recipe_id` (column does not yet exist)

`nutrition_entries` has no `recipe_id` column. The `source_id text` column (migration `20260421200050`) is used for deduplication and sometimes holds a recipe UUID as a string, but it is not declared or constrained as a recipe reference.

All `nutrition_entries` write sites in web and mobile log the `id`, `user_id`, `date_key`, and macro columns. None write a typed `recipe_id`. The column must be added before any client-side code can use it.

Relevant write sites where `recipe_id` should be populated (after the column exists):

| File | Line | Notes |
|---|---|---|
| `apps/mobile/app/(tabs)/index.tsx` | 4270 | `logPlannedMealWithPortion` insert — has `pm.recipe_id` in scope |
| `apps/mobile/app/recipe/[id].tsx` | 1231 | Recipe detail "Log" insert — has `recipe.id` in scope |
| `apps/mobile/app/(tabs)/barcode.tsx` | 173, 238 | Barcode log insert |
| `src/context/appData/useNutritionJournalState.ts` | 187 | `addLoggedMealForDate` insert — `LoggedMeal` has no `recipeId` field today |

### 1c. `src/lib/supabase/phase1LegacyJsonb.ts` — dead code

This file probes for `nutrition_journals` / `meal_plans` / `*_legacy` tables which no longer exist. It is still imported in:

- `src/context/appData/useNutritionJournalState.ts:9–11` — fallback path
- `src/context/AppDataContext.tsx:63` — fallback for plan load and write
- `src/lib/account/nukeAccountData.ts:8` — nukes `nutrition_journals` (no-op on production)
- `apps/mobile/app/(tabs)/index.tsx:3694` — fallback planned-meals read

None of these fallback branches ever fire in production because the table probes always fail with "table does not exist", which the shim catches and silently skips. The shim adds latency to every startup (one probe per table name, sequentially). Removing it is part of Phase 3 of this plan.

---

## 2. Current schema state (canonical)

```sql
-- meal_plan_meals (from 20260413100000 + amendments)
recipe_id  text              -- NO FK, NO uuid cast, orphan-prone
leftover_of_recipe_id  text  -- same problem (secondary FK needed but lower priority)

-- nutrition_entries
-- recipe_id column does not exist
source_id  text              -- opaque dedup key; sometimes holds recipe UUID as string
```

The `recipes.id` column type is `uuid` (confirmed via `database.types.ts`: `id: string` with FK on `saves.recipe_id uuid not null references public.recipes(id) on delete cascade`).

---

## 3. Proposed schema changes

### 3a. `meal_plan_meals.recipe_id` — cast to uuid and add FK

```sql
-- Step 1: scrub non-uuid values (e.g. legacy string ids from old planners)
UPDATE public.meal_plan_meals
  SET recipe_id = NULL
  WHERE recipe_id IS NOT NULL
    AND recipe_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Step 2: add new typed column
ALTER TABLE public.meal_plan_meals
  ADD COLUMN IF NOT EXISTS recipe_id_uuid uuid
    REFERENCES public.recipes(id) ON DELETE SET NULL;

-- Step 3: backfill from text column (safe: only valid UUIDs remain after step 1)
UPDATE public.meal_plan_meals
  SET recipe_id_uuid = recipe_id::uuid
  WHERE recipe_id IS NOT NULL;

-- Step 4: drop old column, rename new
ALTER TABLE public.meal_plan_meals DROP COLUMN recipe_id;
ALTER TABLE public.meal_plan_meals RENAME COLUMN recipe_id_uuid TO recipe_id;

-- Index for "all plans referencing recipe X" (used when a recipe is deleted)
CREATE INDEX IF NOT EXISTS meal_plan_meals_recipe_id_idx
  ON public.meal_plan_meals (recipe_id)
  WHERE recipe_id IS NOT NULL;
```

**Naming convention:** follows existing FK pattern (`meal_plan_meals_plan_day_id_fkey`, `saves_recipe_id_fkey`). Supabase will auto-name the constraint `meal_plan_meals_recipe_id_fkey`.

**RLS:** no change. Existing "Own plan meals" policy checks `plan_day_id → user_id` and is unaffected by `recipe_id` type.

### 3b. `nutrition_entries` — add `recipe_id uuid` FK

```sql
ALTER TABLE public.nutrition_entries
  ADD COLUMN IF NOT EXISTS recipe_id uuid
    REFERENCES public.recipes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS nutrition_entries_recipe_id_idx
  ON public.nutrition_entries (recipe_id)
  WHERE recipe_id IS NOT NULL;
```

No backfill. Historical entries do not have a typed recipe link. `source_id` continues to serve its dedup role unchanged.

**RLS:** no change. "Own nutrition entries" policy checks `user_id` and is unaffected.

### 3c. `save_meal_plan` RPC — validate and cast `recipe_id`

The RPC currently reads `m->>'recipe_id'` and passes it as `text` to the insert. After the column is `uuid`, the RPC must cast:

```sql
nullif(m->>'recipe_id', '')::uuid
```

A non-UUID string (e.g. an old client sending a legacy id) will raise `invalid_text_representation`. The RPC should catch this and NULL out the field rather than failing the whole plan save.

---

## 4. Migration strategy — phased

Pre-launch with one tester, phases 1 and 2 are collapsed into a single PR. Phase 3 is a separate PR (client cleanup).

### Phase 1 — DB: migrate `meal_plan_meals.recipe_id` to uuid FK + add `nutrition_entries.recipe_id`

**What:** Single migration file that:
1. Scrubs non-UUID values from `meal_plan_meals.recipe_id` text column.
2. Adds `recipe_id_uuid uuid references recipes(id) on delete set null`, backfills, drops old column, renames.
3. Adds `nutrition_entries.recipe_id uuid references recipes(id) on delete set null`.
4. Adds both indexes.
5. Updates `save_meal_plan` RPC to cast `recipe_id` as uuid with a null-on-error guard.

**Apply:** stage the SQL file, Grace runs `supabase db push --linked`. Do not use MCP `apply_migration`.

**Risk if we stop here:** Client code still sends `recipe_id` as a string inside the RPC's JSON payload. The RPC now casts it. Old clients (clients built before this PR) send valid UUIDs or `null`, so the cast will succeed. No client changes required to make Phase 1 safe — the existing planner code already sets `recipe_id: m.recipeId ?? null` and `recipeId` is always a UUID or undefined.

**What breaks:** nothing, if the scrub query runs without error. In the unlikely event any `meal_plan_meals.recipe_id` holds a non-UUID string (legacy planners before T7), those rows are scrubbed to NULL before the cast. The user sees their plan slot lose its recipe link — recoverable by re-adding the recipe to the plan. Since there is one tester this is acceptable pre-launch.

**Duration:** 2–3 hours (write + test migration locally, push, update `database.types.ts`, update `save_meal_plan` RPC test in `tests/unit/saveMealPlanRpcMigration.test.ts`).

### Phase 2 — Client: propagate `recipe_id` on nutrition_entries inserts

**What:** Wire `recipe_id` into the `nutrition_entries` insert at every call site where a recipe UUID is available in scope:

- `apps/mobile/app/(tabs)/index.tsx:4270` — `logPlannedMealWithPortion` has `pm.recipe_id` in scope; add `recipe_id: pm.recipe_id ?? null` to the insert.
- `apps/mobile/app/recipe/[id].tsx:1231` — recipe detail log; add `recipe_id: recipe.id`.
- `apps/mobile/app/(tabs)/barcode.tsx:173, 238` — barcode; add `recipe_id` if a recipe id is known at the barcode scan site (check in scope).

Extend `LoggedMeal` type to carry optional `recipeId?: string`, and add it to `buildNutritionEntryRow` in `useNutritionJournalState.ts` so web log paths also populate it.

Update `database.types.ts` on both web and mobile to include `recipe_id` in `nutrition_entries.Row / Insert / Update`.

**Risk if we stop here:** Historical `nutrition_entries` rows have no `recipe_id`. The FK is `ON DELETE SET NULL`, so no constraint violations. The only gap is that past journal entries cannot be reverse-linked to recipes — acceptable.

**Duration:** 3–4 hours (type extension + 4 call site updates + both `database.types.ts` files + tests).

### Phase 3 — Client: remove `phase1LegacyJsonb.ts` dead code

**What:**
- Delete `src/lib/supabase/phase1LegacyJsonb.ts`.
- Remove all imports and the fallback code paths that call `fetchMealPlanJson`, `upsertMealPlanJson`, `fetchNutritionJournalByDay`, `upsertNutritionJournalByDay`.
- In `src/context/AppDataContext.tsx`: remove the legacy fallback branch (lines ~782–791) and the `upsertMealPlanJson` fallback in the plan-save debounce (lines ~1391–1407).
- In `src/context/appData/useNutritionJournalState.ts`: remove the legacy fallback branch (lines ~112–117) and the `probeAnyNutritionJournalJsonTable` call.
- In `src/lib/account/nukeAccountData.ts`: remove the `upsertNutritionJournalByDay` nuke (the tables are gone; this call silently no-ops but is confusing).
- In `apps/mobile/app/(tabs)/index.tsx`: remove the legacy fallback branch (line ~3694).
- Close PR #187 if the "Recipe removed" badge was the only motivation for it; the FK `ON DELETE SET NULL` now handles the orphan case at the DB level.

**Risk:** If a device is running a version of the app built before the Phase 1 migration, the legacy fallback would have failed silently anyway (tables are gone). Removing the shim does not change the outcome for those clients.

**Duration:** 2–3 hours (deletion + cleanup + CI green check).

---

## 5. Risk assessment per phase

| Phase | Broken if we stop here | RLS impact | Web parity | Mobile parity |
|---|---|---|---|---|
| Phase 1 (DB) | None. RPC now casts recipe_id correctly. Old client values are valid UUIDs. | None — RLS policies unchanged | None — web reads don't select recipe_id today | None — mobile reads recipe_id from the same column |
| Phase 2 (client wiring) | Partial: new journal entries from recipe/barcode logs will have recipe_id = NULL (same as before Phase 2). No regression. | None | Web insert paths need updating alongside mobile | Both must update in same PR |
| Phase 3 (dead code removal) | None. Legacy tables are already gone; fallbacks never execute. | None | Remove from both web and mobile in same PR | Same |

**Pre-launch collapse:** Given one tester and no live users, Phases 1 and 2 can ship in a single PR. Phase 3 is a clean-up PR that can follow immediately or be bundled.

---

## 6. Code paths that need new logic (not just type fixes)

### `save_meal_plan` RPC — graceful uuid cast

The RPC currently does `m->>'recipe_id'` (returns text). After Phase 1, the column is `uuid`. The RPC's `INSERT` must cast:

```sql
nullif(m->>'recipe_id', '')::uuid
```

If a client sends a malformed id, Postgres raises `22P02` (invalid_text_representation). The RPC should catch this per-row and NULL the field rather than aborting the whole plan save. Wrap in a `BEGIN / EXCEPTION WHEN invalid_text_representation THEN NULL END` block, or pre-validate with a regex check before casting.

### `DayPlanMeal.recipeId` — populate on plan load (web)

`src/context/AppDataContext.tsx` (lines 746–773) maps `meal_plan_meals` rows to `DayPlanMeal` objects but does NOT include `recipe_id` in the select or map. After Phase 1, add `recipe_id` to the `.select(...)` call and map it to `recipeId` on the returned object. Same change needed in `apps/mobile/app/(tabs)/planner.tsx:1109`.

Currently the mobile planner load also omits `recipe_id` from the select. This means the planner re-render after load loses the recipeId that was present at save time. It was recoverable only because the save payload comes from in-memory state. After Phase 1, this gap should be closed: select `recipe_id` and map it, so a hard-reload (kill + open) restores `recipeId` on each slot.

### `LoggedMeal` type — add optional `recipeId`

`src/types/recipe.ts` and `apps/mobile/lib/nutritionJournal.ts` define `LoggedMeal`. Neither has `recipeId`. Add `recipeId?: string` to both. Wire it through `buildNutritionEntryRow` so the `nutrition_entries` insert receives `recipe_id`.

---

## 7. Test strategy

### Phase 1

- **Migration test (existing pattern):** extend `tests/unit/saveMealPlanRpcMigration.test.ts` to assert the updated RPC body contains `::uuid` cast for `recipe_id`.
- **Schema snapshot test:** add a test that reads the migration file and asserts `references public.recipes(id) on delete set null` appears for both `meal_plan_meals` and `nutrition_entries`.
- **Unit test — uuid scrub:** add a test in a new `tests/unit/mealPlanRecipeIdCast.test.ts` that verifies the scrub regex correctly identifies non-UUID strings and passes valid UUIDs.
- **Integration:** run `supabase db push --linked` against a fresh local DB and confirm `\d meal_plan_meals` shows `recipe_id uuid` with FK.

### Phase 2

- **Type test:** confirm `DayPlanMeal.recipeId` and `LoggedMeal.recipeId` are present in type snapshots (TypeScript compilation via `npm run ci`).
- **Insert test:** extend `tests/unit/journalSupabasePersistence.test.ts` to assert that `buildNutritionEntryRow` includes `recipe_id` when `meal.recipeId` is set.
- **Call-site grep test:** add a check that `logPlannedMealWithPortion` passes `recipe_id` to the `nutrition_entries` insert (same pattern as `tests/unit/journalSupabasePersistence.test.ts`).

### Phase 3

- **Dead code removal:** after deleting `phase1LegacyJsonb.ts`, `npm run ci` must pass with no import errors. This is the sole validation gate — the file was already unreachable.
- **No new tests needed.** Removing unreachable code requires no new assertions.

---

## 8. Effort per phase

| Phase | Effort | Notes |
|---|---|---|
| Phase 1 — DB migration + RPC update | 3–4 h | Migration SQL + RPC edit + migration test + `db push` |
| Phase 2 — Client wiring | 3–4 h | 4 insert sites + type extensions + `database.types.ts` regen |
| Phase 3 — Dead code removal | 2–3 h | File delete + 4 import removals + CI pass |
| **Total** | **8–11 h** | Fits within the 3–4 day estimate |

---

## 9. Open decisions for Grace

**1. ON DELETE SET NULL vs ON DELETE CASCADE on `meal_plan_meals.recipe_id`**

`SET NULL` means a deleted recipe leaves the planned slot intact with `recipe_id = NULL` — the slot title and macros survive, the user just loses the link to the recipe detail. `CASCADE` means deleting a recipe also deletes every planned meal that referenced it, which may surprise users who planned around a recipe they later unpublished.

Recommendation: `SET NULL` on `meal_plan_meals.recipe_id` (preserves the user's plan structure) and `SET NULL` on `nutrition_entries.recipe_id` (journal entries should survive recipe deletion). Same policy already applied to `household_meals.recipe_id` (see migration `20260420100000`).

**2. Backfill `nutrition_entries.recipe_id` for historical rows, or leave them NULL?**

A backfill is possible only if `nutrition_entries.source` = `'recipe'` and `source_id` holds a valid UUID that still exists in `recipes`. The match rate will be low (source_id is not consistently populated) and the benefit is mostly analytics, not data integrity. For pre-launch with one tester, skipping backfill is the right call. Confirm so the migration does not attempt it.

**3. Drop `phase1LegacyJsonb.ts` in Phase 1 PR or Phase 3 PR?**

Since it's dead code and its removal is low-risk, it could go in Phase 1 to reduce the overall PR count (cap-of-3 rule). However, if Phase 1 hits an unexpected snag, having the client cleanup bundled in makes rollback messier. Recommendation: keep Phase 3 as a separate PR so Phase 1 is purely a DB change.

---

## Ready for executor agent to start Phase 1

The executor can begin immediately:

1. Create migration file at `supabase/migrations/20260510100000_recipe_id_fk_cascade.sql` implementing the schema changes in section 3 above.
2. Update `save_meal_plan` RPC in the same file (or as a separate amended migration) to cast `recipe_id` via `nullif(m->>'recipe_id', '')::uuid` with error handling.
3. Stage the file. Do not apply via MCP `apply_migration`. Ask Grace to run `supabase db push --linked`.
4. Regenerate `src/lib/supabase/database.types.ts` and `apps/mobile/lib/database.types.ts` after the push to reflect the new column types.
5. Update `tests/unit/saveMealPlanRpcMigration.test.ts` to assert the uuid cast.
6. Run `npm run ci` locally. Confirm green. Push as PR.

No decisions are needed from Grace before Phase 1 starts — the `SET NULL` policy (decision 1 above) is already the recommendation, and the executor should proceed on that basis unless Grace says otherwise.
