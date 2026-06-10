# Schema plan: step-centric recipe model (ENG-989, borrowed from Julienne)

**Created:** 2026-06-08
**Author:** product-engineer (planning pass — no code written)
**Status:** PLAN ONLY — needs review before any migration is staged
**Linear:** ENG-989
**Estimated total effort:** ~16–22 hours across 4 PRs (phased, flag-gated)

---

## TL;DR — recommended approach

**Additive, not replacement.** Keep the flat `recipe_ingredients` table exactly as it
is — it is the source of truth for nutrition totals, the macro-by-ingredient
breakdown, shopping, verification, and the ingredient-image system, and every one
of those depends on the row-level "full whole-recipe macro contribution per
ingredient" invariant. Layer step structure on top as **two new nullable columns**
plus **one new child table for steps**:

1. `recipe_steps` — ordered step text per recipe (replaces parsing the
   `recipes.instructions` text blob at read time; the blob stays as a fallback +
   export field, dual-written during rollout).
2. `recipe_ingredients.step_id uuid NULL` (FK → `recipe_steps.id ON DELETE SET NULL`)
   — associates an ingredient row with the step it is used in. NULL = "not yet
   associated / pantry staple / shown in the flat list only". This is the
   step-association the brief calls the lower-risk option.
3. `recipe_ingredients.position int NULL` — explicit ordering within a recipe (and,
   when `step_id` is set, within a step). The table has **no ordering column today**
   — order is implicit on insertion order — so this is net-new correctness, not
   just rework.

The "ingredients nested inside each step as `{name, quantity, unit}`" view the brief
wants is then a **derived read-model**, assembled in shared TS from
`recipe_steps` + `recipe_ingredients WHERE step_id = step.id`. The flat list the
nutrition engine + shopping depend on stays the literal `recipe_ingredients` rows —
**no flattening, no dedup, no drop-processed pass is ever run to PRODUCE the flat
list**, because the flat list already exists and is canonical. Flatten/dedup/
drop-composite runs only in the *opposite* direction conceptually (it's how a
nested import is decomposed INTO flat rows on write) and even there we reuse the
existing `canonicalImageKey` / `cleanIngredientDisplayName` / shopping
`ingredientNameKey` primitives rather than inventing a new collapser.

Why this is the safe call: the flat table is load-bearing for ~30 code paths and a
hard nutrition invariant. Replacing it with a nested store would force a rewrite of
the nutrition aggregation, the macro-detail breakdown, shopping, verification RPC,
the ingredient-image backfill key, and export — for zero nutrition gain, since the
nested structure carries no macro data the flat rows don't already carry. Adding
`step_id` + `position` unlocks every feature the brief wants (inline cook-mode
amount-chips, pantry-aware shopping, allergen→substitution) while leaving every
existing read path byte-for-byte unchanged when `step_id` is NULL.

---

## 1. Current state — audit

### 1a. The two tables today (authoritative, from generated types + migrations)

**`recipes`** (`src/lib/supabase/database.types.ts` ~L1496):
- `instructions text NULL` — a **single text blob**. Steps are not relational. Every
  read path splits it on newlines: `normaliseInstructions(row.instructions).split(/\n+/)`.
  The normaliser (`src/lib/recipes/normaliseInstructions.ts`) deliberately does NOT
  split into steps — "callers that need an array still run `.split(/\n+/)`… so step
  parsing stays co-located with the rendering code." (i.e. step boundaries are a
  render-time heuristic, not stored data.)
- Denormalised macro aggregates live on the row: `calories, protein, carbs, fat,
  fiber_g, sugar_g, sodium_mg, caffeine_mg, alcohol_g`. These are the **rollup** of
  the ingredient rows.

**`recipe_ingredients`** (`src/lib/supabase/database.types.ts` ~L1356):
- Flat, one row per ingredient line. FK `recipe_id → recipes.id` (CASCADE, per
  `20260511100000_recipe_id_fk_cascade.sql`).
- Columns: `name`, `amount numeric NULL`, `unit text NULL`, full macro snapshot
  (`calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, caffeine_mg,
  alcohol_g`), match metadata (`confidence, source, fatsecret_food_id,
  ingredient_id, is_verified`), `override_macros jsonb`, `added_by_user bool`.
- **No `position` / `sort_order` / `step_index` column.** Ordering is implicit
  insertion order. The importers write rows with an array index `i` but **do not
  persist it** (see `apps/mobile/lib/saveImportedRecipe.ts` L212 — `ingredients.map((name, i) =>`
  computes `i` only to index into the parallel `macros[i]` array, then drops it).
- **The sacred invariant** (`src/lib/nutrition/macroIngredientBreakdown.ts` header):
  *"`recipe_ingredients` rows each hold an ingredient's FULL macro contribution at
  the recipe's base servings."* The recipe-level macros are the sum of these rows.
  The macro-detail "By ingredient" breakdown reconstructs per-ingredient
  contribution as `row.<macro> × entry.portion_multiplier`, then NORMALISES so the
  parts always sum back to the logged entry's stored total. **Any migration that
  perturbs these per-row macro values silently corrupts both recipe totals AND every
  historical logged meal's breakdown.**

### 1b. How ingredients relate to steps today

They **don't**. The importer (`src/lib/recipe-import/parseRecipeFromHtml.ts`,
`ParsedRecipeDraft`) already produces `ingredients: string[]` and
`instructions: string[]` as two independent arrays with **no cross-reference** —
exactly the gap ENG-989 closes. Both detail screens render them in parallel,
unlinked:
- Web `src/app/components/RecipeDetail.tsx`: `activeTab: "ingredients" | "steps" | "nutrition"`
  — separate tabs, separate lists.
- Mobile `apps/mobile/app/recipe/[id].tsx`: `<RecipeIngredientGrid>` and
  `<RecipeMethodSteps>` (`apps/mobile/components/recipe/`) — separate components, fed
  separately.
- Cook mode (`src/app/components/CookMode.tsx`, web only) takes
  `instructionSteps: string[]` and `ingredients: IngredientRow[]` as **two separate
  props**. Today's "inline amounts in step text" is a *regex guess*:
  `scaleStepText(cleanStepText(stepRaw), scaleFactor)` (`src/lib/nutrition/scaleStepText.ts`)
  parses quantities OUT of the prose. It cannot know "this 2 tbsp belongs to the
  olive-oil ingredient row" — there is no link.

### 1c. The cook-mode flow

- Web: `CookMode.tsx` (1,070 lines). Steps array, current-step pointer, a
  "show ingredients" drawer that lists ALL ingredients (checkbox set keyed by array
  index), per-step timer parsing, per-step text scaling. No per-step ingredient
  subset.
- Mobile: cook mode is inline in `apps/mobile/app/recipe/[id].tsx`
  (`cookMode`/`cookStep` state) reusing the same `scaleStepText` shared module.
- Parity is already enforced by tests: `apps/mobile/tests/unit/cookAnalyticsParity.test.ts`,
  `cookWatchOriginalParity.test.ts`, `cookHandsfreeFeatureFlag.test.tsx`.

### 1d. The shopping / grocery flow

`src/lib/planning/generateShoppingList.ts`:
- Consumes flat `{ name, amount, unit }` rows ONLY.
- Dedups across recipes by `normalizeKey(name, unit) = name.toLowerCase()|unit.toLowerCase()`.
- Sums numeric amounts; concatenates source recipe titles into `from`.
- **No "have vs missing" / pantry concept exists today.** The shopping screen
  (`apps/mobile/app/shopping.tsx`) has no pantry table, no have/missing split — that
  is a feature step-centric *enables*, not one it migrates.
- Fed by `AppDataContext.tsx` (web, L1253 — batched `recipe_ingredients .in(recipe_id)`)
  and `apps/mobile/app/shopping.tsx` (L182 — per-recipe fetch via `meal_plan_meals.recipe_id`).
- Reuses `src/lib/planning/ingredientNameKey.ts` and
  `normalizeShoppingIngredientRow.ts` for the dedup key. **This key is intentionally
  separate from the image key** (`canonicalImageKey.ts` header: *"Leaves
  `ingredientNameKey.ts` UNTOUCHED — shopping/plan overlap still key by it"*).

### 1e. Every code path that touches `recipe_ingredients` (blast radius)

Reads/writes found via grep (excluding generated types, tests, CHANGELOG):

| File | Role | Reads `step_id`/`position`? |
|---|---|---|
| `src/app/components/RecipeDetail.tsx` | web detail load + render + add/override ingredient | will (read-model) |
| `app/recipe/[id]/page.tsx` | web public SSR recipe load | will (read-model) |
| `src/context/AppDataContext.tsx` | web library load + ingredient insert + shopping batch | will (write `position`) |
| `src/lib/planning/generateShoppingList.ts` | shopping dedup/merge | no (flat list unchanged) |
| `src/lib/planning/planImport/persistImportRecipe.ts` | web plan-import write | will (write `step_id`+`position`) |
| `src/lib/recipes/createRecipeWizard.ts` | shared wizard step-machine (already has `steps`!) | will (write) |
| `src/lib/recipes/recipeEdit.ts` | web edit | will (write) |
| `src/lib/nutrition/macroIngredientBreakdown.ts` | **macro invariant** — derive/scale/reconcile | no (must not change) |
| `src/lib/nutrition/allocateIngredientMacrosFromLines.ts` | offline macro fill | no |
| `src/lib/nutrition/macroDetailBreakdown` / `apps/mobile/app/macro-detail.tsx` | macro-by-ingredient UI | no |
| `src/lib/nutrition/mealPlanAlgo.ts` | plan algorithm | no |
| `src/lib/account/nukeAccountData.ts`, `app/api/account/delete`, `app/api/export/me` | GDPR delete/export | will (export step structure) |
| `src/lib/recipe/{enqueueIngredientImages,canonicalImageKey,cleanIngredientDisplayName,ingredientImages}.ts` | ingredient images | no (keyed by name) |
| `app/api/ingredient-image/route.ts` | image generate-on-miss | no |
| `apps/mobile/app/recipe/[id].tsx` | mobile detail load + render + cook + verify | will (read-model) |
| `apps/mobile/app/create-recipe.tsx`, `components/recipe/CreateRecipeWizard.tsx` | mobile create | will (write) |
| `apps/mobile/components/recipe/RecipeEditSheet.tsx` | mobile edit | will (write) |
| `apps/mobile/lib/saveImportedRecipe.ts` | mobile import write | will (write `step_id`+`position`) |
| `apps/mobile/lib/planImportCommit.ts` | mobile plan-import write | will (write) |
| `apps/mobile/lib/recipes.ts`, `verifyRecipe.ts` | mobile load + verify | no (verify keys by `id`) |
| `apps/mobile/app/recipe/verify.tsx` | verify screen | no |
| `apps/mobile/app/shopping.tsx` | mobile shopping | no (flat list unchanged) |
| `supabase/migrations/…save_verified_ingredients_rpc.sql` | atomic verify RPC | no (updates by `id`; ignores new cols) |

**Conclusion:** with `step_id`/`position` nullable and defaulting to NULL, **every
existing read path is unaffected** until it opts into the read-model. The verify RPC
updates rows by `id` and never references the new columns — it keeps working as-is.

---

## 2. Target model

### 2a. New table — `recipe_steps`

```
recipe_steps
  id           uuid PK default gen_random_uuid()
  recipe_id    uuid NOT NULL  FK → recipes(id) ON DELETE CASCADE
  position     int  NOT NULL          -- 0-based order within the recipe
  instruction  text NOT NULL          -- the step prose (one step)
  created_at   timestamptz NOT NULL default now()
  UNIQUE (recipe_id, position)
```
- CASCADE on recipe delete (a step has no meaning without its recipe; matches the
  existing `recipe_ingredients` CASCADE).
- RLS: identical posture to `recipe_ingredients` — select via published-or-owned
  recipe; write only by the recipe owner. (Carbon-copy the
  `recipe_ingredients_*_own_recipe` and `recipes_select_via_save` policies, keyed
  through `recipe_id`.) Default-deny.

### 2b. New columns on `recipe_ingredients`

```
ALTER TABLE recipe_ingredients
  ADD COLUMN step_id  uuid NULL  FK → recipe_steps(id) ON DELETE SET NULL,
  ADD COLUMN position int  NULL;        -- order within recipe (and within step)
```
- `step_id` SET NULL (not CASCADE): if a step is deleted but the ingredient is still
  in the recipe, the ingredient must NOT vanish — it falls back to the flat list
  (NULL `step_id`). This protects the nutrition invariant: deleting a step can never
  delete an ingredient row and thus can never change recipe totals.
- `position` nullable so the backfill can leave legacy rows unordered without
  inventing a false order; new writes always set it.
- No new macro columns, no change to any existing column, no change to defaults of
  existing columns.

### 2c. The derived nested read-model (TS, shared — NOT in the DB)

New shared module `src/lib/recipe/recipeStepModel.ts` (mobile via `@suppr/shared`):

```
type StepIngredient = { name: string; quantity: string | null; unit: string | null };
type RecipeStepView = { id: string; position: number; instruction: string;
                        ingredients: StepIngredient[] };
type RecipeStructuredView = {
  steps: RecipeStepView[];
  // The flat list stays canonical and untouched:
  flatIngredients: IngredientRow[];      // = all recipe_ingredients rows, ordered by position
  unassignedIngredients: IngredientRow[]; // rows with step_id = NULL (pantry staples etc.)
};

function buildRecipeStructuredView(
  steps: RecipeStepRow[],
  ingredients: RecipeIngredientRow[],
): RecipeStructuredView
```
- Pure, sync, no I/O. Group `ingredients` by `step_id`; order by `position`.
- `{name, quantity, unit}` for the step view comes straight off the row
  (`quantity = String(amount)`), display-cleaned via the EXISTING
  `cleanIngredientDisplayName` — no new collapser.
- **`flatIngredients` is the literal rows** — there is no flatten/dedup/drop pass.
  The brief's "flatten → dedup → drop processed/composite" is what the *importer*
  does on the WRITE side (§3b), reusing existing primitives; the read side never
  re-derives the flat list because it already is the rows.

### 2d. Why not replace the flat list?

| | Additive (`step_id`+`position`+`recipe_steps`) — RECOMMENDED | Replace flat with nested store |
|---|---|---|
| Nutrition invariant | Preserved byte-for-byte | Must rebuild aggregation + breakdown + reconcile |
| Macro-by-ingredient (logged meals) | Unchanged | Rewrite `macroIngredientBreakdown.ts` |
| Shopping dedup | Unchanged | Rewrite to walk nested → flat first |
| Verify RPC | Unchanged (by-id) | Rewrite RPC |
| Ingredient-image backfill key | Unchanged | Re-key |
| Export/GDPR | Add steps; flat unchanged | Rewrite export shape |
| Rollback | Drop 2 cols + 1 table, zero data loss | Catastrophic — flat list is gone |
| Nutrition gain | None lost; features gained | None — nested carries no macro the flat rows lack |

The nested structure adds **structure**, not **nutrition**. So it belongs *alongside*
the canonical flat rows, not instead of them.

---

## 3. Backfill

### 3a. Existing recipes (flat ingredients today)

**Default: stay flat with NULL step association.** On migration apply:
- `recipe_ingredients.step_id` = NULL, `position` = NULL for every existing row.
- `recipe_steps` gets ZERO rows initially. Read paths that opt into the structured
  view fall back to the legacy `recipes.instructions` blob split (unchanged behaviour)
  when a recipe has no `recipe_steps` rows.
- This is a **pure column-add migration with no data movement** → trivially
  reversible, idempotent, zero nutrition risk. No recipe total changes because no
  ingredient row's macro values are touched.

**Optional later backfill (separate, non-blocking PR — Phase 3):** populate
`recipe_steps` from each recipe's `instructions` blob via the same
`normaliseInstructions(...).split(/\n+/)` the renderers already use, writing one
`recipe_steps` row per split line with `position = idx`. **Ingredients are NOT
auto-associated to steps** — mapping "which ingredient is used in which step" from
free prose is exactly the low-confidence guess CLAUDE.md forbids. They stay NULL
(flat) until a user edits, or an importer provides explicit structure (§3b). A
backfilled recipe therefore renders steps relationally but still shows its full
ingredient list flat — strictly better than today, never worse.

### 3b. New imports — where nested structure is BORN

The importer is the natural origin of true step→ingredient association (Julienne's
model). When the LLM extract (`extractSocialRecipe.ts`) or JSON-LD parse can emit
`steps: [{ instruction, ingredients: [{name, quantity, unit}] }]`:
1. Write `recipe_steps` rows (one per step, `position = idx`).
2. **Decompose to flat `recipe_ingredients` as today** — every step-ingredient still
   becomes a flat row (so nutrition + shopping are unchanged), now carrying
   `step_id` + `position`.
3. **Flatten → dedup → drop-processed/composite** runs HERE, on the write side, to
   produce the canonical flat rows from the nested input:
   - *Flatten*: collect all `step.ingredients`.
   - *Dedup*: an ingredient appearing in two steps (e.g. "salt") collapses to ONE
     flat row using the EXISTING shopping key `ingredientNameKey(name, unit)`
     (`src/lib/planning/ingredientNameKey.ts`) — and that one row's `step_id` points
     to its FIRST step (or NULL if it spans many). The OTHER step occurrences keep
     a lightweight `recipe_step_ingredient_refs` link only if we need many-to-many
     (see Risk R3) — v1 keeps it one-step-per-ingredient and accepts that a salt
     used twice shows under its first step.
   - *Drop processed/composite*: a "sauce" sub-recipe step ("whisk all sauce
     ingredients") is NOT a flat ingredient — its components are. The importer
     already emits components, not the composite; the drop pass uses the existing
     `cleanIngredientDisplayName` parenthetical/compose heuristics, NOT a new
     classifier. Nutrition is unaffected because composites never had macro rows.
4. **Nutrition runs on the flat rows exactly as today** (`/api/nutrition/verify-recipe`).
   The nested structure is metadata layered on; it never feeds the matcher (same
   firewall `cleanIngredientDisplayName` already enforces).

If the importer can only emit unstructured `instructions: string[]` (most sites),
behaviour is identical to today: steps stored as text/`recipe_steps`, ingredients
flat + NULL `step_id`.

---

## 4. Migration safety (data-integrity lens)

| Property | How it's met |
|---|---|
| **No orphaned ingredients** | `step_id` is SET NULL on step delete — an ingredient can never be orphaned by step removal; it reverts to the flat list. `recipe_id` CASCADE unchanged. |
| **No nutrition-total drift** | The migration adds columns ONLY; it never reads, writes, or recomputes any macro value. Recipe totals = sum of `recipe_ingredients` rows, and not one row's macro changes. A guard test asserts `SUM(recipe_ingredients.calories) per recipe` is identical pre/post. |
| **Flat list stays correct** | The flat list IS `recipe_ingredients` rows; nothing removes, merges, or reorders rows in the DB. `position` is additive ordering metadata; readers that ignore it see today's behaviour. Shopping + nutrition + image key all read the unchanged rows. |
| **Reversible** | Down = `DROP TABLE recipe_steps; ALTER TABLE recipe_ingredients DROP COLUMN step_id, DROP COLUMN position;`. Zero ingredient data lost (steps were a layer; the `instructions` blob was never removed). |
| **Idempotent** | `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, policy creates guarded by `pg_policies` existence check (the repo's standard pattern — see `20260608120000_ingredient_images.sql`). Re-running the migration is a no-op. |
| **Apply path** | Tracked file → `supabase db push --linked` (authorised). **NEVER** MCP `apply_migration` (rewrites `schema_migrations.version` to NOW(); drifts from file timestamp). Regenerate types after: `npm run db:types`. |
| **Verify RPC safe** | `save_verified_ingredients` updates by `id`, lists explicit columns, never touches `step_id`/`position` → keeps working untouched. |

**Dual-write window for `instructions`:** during rollout, writers populate BOTH
`recipes.instructions` (the blob — kept for export, legacy readers, and as the
ground-truth fallback) AND `recipe_steps`. The blob is NOT dropped in this plan; a
separate far-future cleanup PR can retire it only after `recipe_steps` is 100% and
export has migrated. (Same phasing discipline as the FK-cascade refactor's Phase 3
shim deletion.)

---

## 5. Surfaces touched + parity plan

All four product surfaces gate behind a single flag `step-centric-recipes`
(web `isFeatureEnabled` / mobile `apps/mobile/lib/analytics.ts`), old path alive in
the `else`, per CLAUDE.md feature-flag rule.

| Surface | Web | Mobile | Parity |
|---|---|---|---|
| **RecipeDetail** | `src/app/components/RecipeDetail.tsx` + `app/recipe/[id]/page.tsx` — read-model assembles steps with their ingredient chips; flat tab still available | `apps/mobile/app/recipe/[id].tsx` — `RecipeIngredientGrid` + `RecipeMethodSteps` consume the same `buildRecipeStructuredView`; steps gain inline ingredient chips | Same shared module → identical grouping. Tests: extend `createRecipeNormalisationParity` |
| **Cook mode** | `src/app/components/CookMode.tsx` — pass `step.ingredients` so the current step shows EXACT amount-chips from the rows (not regex-guessed via `scaleStepText`); fall back to `scaleStepText` when `step_id` NULL | inline cook in `recipe/[id].tsx` — same | `scaleStepText` parity tests already exist (`cookWatchOriginalParity`); add a structured-amount-chip parity test |
| **Shopping** | `generateShoppingList.ts` + `AppDataContext` shopping batch — **unchanged** for the list itself; pantry-aware "have vs missing" is a NEW additive layer reading a (future) `pantry_items` table, NOT part of this migration | `apps/mobile/app/shopping.tsx` — same | Pantry feature is a fast-follow (ENG sub-issue); ships its own flag |
| **Create / Edit** | `createRecipeWizard.ts` (already has a `steps` step!) + `recipeEdit.ts` — persist `recipe_steps` + `step_id`/`position` | `CreateRecipeWizard.tsx` + `RecipeEditSheet.tsx` — same shared wizard logic | `createRecipeWizard.test.ts` + `createRecipeNormalisationParity.test.ts` |
| **Import** | `persistImportRecipe.ts` | `saveImportedRecipe.ts`, `planImportCommit.ts` | Both write the same `{recipe_steps, step_id, position}` shape |
| **Export/GDPR** | `app/api/export/me`, `app/api/account/delete`, `nukeAccountData.ts` | (shared API) | Export gains a `steps` array; delete cascades via `recipe_steps` FK |

**Intentional divergences:** none new. Cook mode is web-component + mobile-inline
today (already divergent in *implementation*, identical in *behaviour* via shared
`scaleStepText`) — this plan keeps that and routes both through the same
`buildRecipeStructuredView`, so behaviour parity tightens rather than loosens.

---

## 6. Enabled features (what the structure unlocks)

1. **Inline cook-mode amount-chips** — the current step renders its OWN ingredients
   as exact `{name, quantity, unit}` chips, replacing the regex-from-prose guess.
   Where `step_id` is NULL (legacy / unstructured import), it gracefully falls back
   to today's `scaleStepText`. Strictly additive.
2. **Pantry-aware shopping (have vs missing)** — NOT delivered by this migration; it
   is a *downstream* feature this structure makes clean (a `pantry_items` table +
   a have/missing split over the existing flat shopping list). Tracked as a separate
   ENG sub-issue with its own flag. Flagging it here so it is not read as "shipped".
3. **Allergen → substitution** — `recipes.allergens` already exists
   (`20260503100200_recipes_allergens.sql`). Step structure lets a substitution
   target the SPECIFIC ingredient row in the SPECIFIC step ("swap the butter in
   step 3"), via `step_id` + the ingredient `id`. The substitution *engine* is a
   separate ENG sub-issue (and must route any new nutrition math through
   `nutrition-engine`); the schema here just makes the row addressable.

---

## 7. Risks + phased, flag-gated rollout

### Risks

- **R1 — Macro-total drift (P0).** Mitigated structurally: the migration touches no
  macro value, and a guard test pins `SUM(recipe_ingredients.<macro>) per recipe`
  identical pre/post. Down-migration loses no ingredient data.
- **R2 — Verify RPC / save races.** `save_verified_ingredients` updates by `id` and
  never references the new columns; verifying a recipe leaves `step_id`/`position`
  intact. New importers set them inside the same insert. No RPC change needed in v1.
- **R3 — One ingredient used in multiple steps (e.g. salt in step 1 AND step 5).**
  v1 design: ONE flat row, `step_id` → first step (or NULL if it genuinely spans the
  whole dish). Accepted limitation — nutrition is still correct (one row, one macro
  contribution). If true many-to-many is wanted later, add a thin
  `recipe_step_ingredient_refs (step_id, recipe_ingredient_id)` join in a follow-up;
  the flat rows stay the macro source either way. **Do not** duplicate the ingredient
  row per step (that would double-count macros → R1).
- **R4 — Backfilled steps mis-split.** The `instructions` blob → `recipe_steps`
  backfill (Phase 3) uses the SAME splitter the renderers use today, so the split is
  no worse than what users already see. Ingredients are NOT auto-associated (NULL),
  so a bad split can't mis-attribute an ingredient. The blob is retained as the
  fallback + export source.
- **R5 — Read-path regressions when flag off.** With `step_id`/`position` NULL and
  zero `recipe_steps` rows, `buildRecipeStructuredView` must return exactly today's
  flat behaviour. Covered by a "NULL step_id == legacy render" parity test on both
  platforms before the flag ramps past 0%.
- **R6 — Ordering ambiguity for legacy rows.** `position` NULL on legacy rows →
  readers must fall back to a stable secondary order (`created_at, id`) so existing
  recipes don't reshuffle. Pinned by a test.

### Phased rollout (4 PRs)

- **PR1 — Schema + types (flag OFF, zero UI).** Stage
  `supabase/migrations/<ts>_recipe_steps_and_step_association.sql` (table +
  2 columns + RLS + indexes, all idempotent). Ask Grace to `supabase db push
  --linked`. Run `npm run db:types`. Add `buildRecipeStructuredView` +
  `recipeStepModel.ts` with full unit tests (incl. the NULL-step legacy-parity test
  and the macro-sum guard). **No reader/writer wired yet.** Reversible, invisible.
- **PR2 — Write paths (flag OFF for reads, writers populate).** Importers + wizard +
  edit dual-write `recipe_steps` + `step_id` + `position` (and keep writing the
  `instructions` blob). New recipes get structure; reads still use the legacy path.
  Tests: write-path parity web↔mobile.
- **PR3 — Read surfaces behind `step-centric-recipes` (ramp).** RecipeDetail + cook
  mode (both platforms) consume the structured view when the flag is on and the
  recipe has steps; `else` = today. Before/after screenshots on web AND mobile
  (mandatory). Ramp via PostHog. Optional: the `instructions`→`recipe_steps` backfill
  for legacy recipes (ingredients stay NULL/flat).
- **PR4 (fast-follows, separate flags + ENG sub-issues, route nutrition to
  `nutrition-engine`):** pantry-aware shopping; allergen→substitution engine;
  optional many-to-many step-ingredient refs (R3) if needed.

---

## 8. Open decisions for review

1. **`recipe_steps` vs keeping the `instructions` blob long-term.** This plan keeps
   BOTH (blob as fallback/export). Confirm we want a relational steps table at all,
   or whether step structure should live as JSONB on `recipes` (lighter, but loses
   per-step RLS/indexing and the clean `step_id` FK target). *Recommendation:
   relational `recipe_steps` — matches the repo's "extract JSONB → relational"
   direction (`20260413100000`, `20260511100000`) and gives `step_id` a real FK.*
2. **Many-to-many step↔ingredient now or later?** Recommendation: later (R3) — v1
   one-step-per-ingredient is simpler and nutrition-safe.
3. **Auto-backfill legacy steps in PR3, or leave legacy recipes blob-only forever?**
   Recommendation: backfill (read-model is nicer), ingredients stay NULL — zero
   nutrition risk either way.

---

## Appendix — precedent + reuse

- **Format/phasing precedent:** `docs/planning/schema-refactor-plan-recipe-fk-cascade.md`
  (blast-radius table + phased PRs + RLS-unchanged notes).
- **Idempotent migration pattern:** `20260608120000_ingredient_images.sql`
  (`IF NOT EXISTS`, `pg_policies` guard, service-role-write posture).
- **Reused primitives (no new collapser):** `src/lib/recipe/cleanIngredientDisplayName.ts`,
  `src/lib/recipe/canonicalImageKey.ts`, `src/lib/planning/ingredientNameKey.ts`,
  `src/lib/planning/normalizeShoppingIngredientRow.ts`, `src/lib/recipes/normaliseInstructions.ts`,
  `src/lib/nutrition/scaleStepText.ts`.
- **Nutrition invariant doc:** `src/lib/nutrition/macroIngredientBreakdown.ts` header.
