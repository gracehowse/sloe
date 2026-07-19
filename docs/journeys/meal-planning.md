# User Journey: Meal Planning

**Audience:** Product / Design

## Overview
User generates a macro-aware meal plan from their saved recipes (optionally
widened to Suppr's Discover pool), with configurable plan source, day count,
meal slots, and start date, then adjusts it (lock, swap, move, distribute
budgets around a locked meal) before handing off to Shopping. This doc covers
the **planning stage** of the Plan the Week → Shop → Cook loop — see
[Loops](#loops) below for where it sits relative to Shopping and to the
"What to eat next" north-star loop, and jump straight to
[shopping-list.md](shopping-list.md) for everything after "Generate Shopping
List."

## Entry Points
- Plan tab on the bottom navigation

## Flow

### Step 1: Choose plan source + configure

```
Plan screen shows:
  → "Plan from" source selector:
      • Library — saved recipes only
      • Library & Discovery (default) — saves + Suppr's curated picks, de-duped
      • Discovery only — Suppr's picks only
    Generation is allowed whenever the CHOSEN source has ≥1 recipe, so a
    0-saved account is no longer a dead end (Discovery always has seed
    recipes). Only "Library" at 0 saves disables Generate, with a hint
    pointing back at the selector.
  → Day selector: 1, 3, or 7 days (free tier clamped to 1)
  → Meal slot toggles: Breakfast ✓, Lunch ✓, Snack ✓, Dinner ✓
    (toggle any off — e.g. exclude Snack) — OR a numbered preset (see
    "Meal-slot presets" below)
  → Start date: Today / Tomorrow / Next week (startOffset 0 / 1 / 7)
  → "Generate Plan" button
```

**Why the source selector exists:** previously, mobile silently folded
Discover recipes in below 6 saves while web was saved-only and hard-gated at
0 saves — an invisible, platform-diverging heuristic. Grace's call, 2026-05-31:
*"we should probably always give these options — plan from library only,
library & discovery, only discovery."* One shared helper
(`src/lib/planning/planSource.ts`, `@suppr/shared/planning/planSource` on
mobile) now drives the pool maths, copy, and generate-gate on both platforms
so they can't diverge again. Flag: `plan_source_selector`.

#### Meal-slot presets

Beyond the classic Breakfast/Lunch/Dinner/Snacks toggle set, a user can pick a
**numbered preset** from Settings (`profiles.meal_slot_config`, read by both
Today and Plan):

| Preset | Slots | Who it's for |
|---|---|---|
| `classic` (default) | Breakfast, Lunch, Dinner, Snacks | standard four-meal day |
| `four_meals` | Meal 1 – Meal 4 | grazers who don't map neatly to B/L/D |
| `six_meals` | Meal 1 – Meal 6 | frequent small meals |

When a numbered preset is active, the Plan tab threads the full slot list
into generation (`numberedPresetSlots`) so every slot — including the 5th and
6th on the six-meal preset — gets a real calorie share instead of being
starved to 0 kcal. The classic preset leaves the per-slot toggle row in
charge, unchanged from the original flow.

#### Adjust constraints

An "Adjust" sheet (`AdjustConstraintsSheet`, shared shape web + mobile)
bundles three levers into one place and regenerates on save:

- **Daily calorie floor** — a slider/stepper from 1,200–2,200 kcal (50 kcal
  steps, default 1,450) fed into the joint-fit portion scaler as
  `calorieFloorMin`, so an aggressive cut can't produce a starvation-tiny day.
- **Meals per day** — 3 or 4, mapping onto the enabled classic slot set
  (4 keeps Snacks; 3 drops it).
- **Allow batch & leftovers** — toggle for the leftovers-aware fill described
  below.

The sheet also re-exposes the plan-source selector, so source + floor +
leftovers can all change in one "Save & regenerate" action. Web:
`src/app/components/plan/AdjustConstraintsSheet.tsx` +
`src/lib/planning/planAdjustConstraints.ts`. Mobile:
`apps/mobile/components/plan/AdjustConstraintsSheet.tsx` +
`apps/mobile/app/(tabs)/planner.tsx` (`planCalorieFloor`).

### Step 2: Generate

```
Tapping Generate:
  → Fetches profile targets from Supabase (calories, protein, carbs, fat, fibre)
  → Runs the shared engine (findBestMealSetGeneric / generateSmartPlan) with:
    - The pool selected in Step 1 (library / library+discover / discover)
    - Enabled slots (classic toggles or the numbered preset)
    - Profile targets
  → Algorithm per day:
    1. Filter recipes by meal type per slot
    2. Sample up to MEAL_PLAN_SAMPLER_CAP = 2,000 combinations with a
       per-day unique seed, biased 60% toward top-half-fit recipes
    3. Compute portion multipliers (0.5x–2x) via a joint-fit scaler
       (protein → calories → carbs → fat → fibre priority)
    4. Score against macro targets (protein deviation weighted 4x;
       over-target calories penalised 3x vs 1.5x under)
    5. Hard-reject the same recipe twice in one day
    6. Apply a recency penalty of MEAL_PLAN_RECENCY_PENALTY = 100/recipe
       for variety across days
  → Returns DayPlan[] with meals, multipliers, totals (surfaces
    residualProteinGap when the pool can't reach the protein target)
  → Persists to Supabase meal_plans table
```

**Why these numbers, not the old ones:** the sampler cap was cut from an
inline `20_000` to the exported constant `MEAL_PLAN_SAMPLER_CAP = 2_000` —
the 20k cap froze the JS thread for 6–11s on an iPhone 12-class device at
pool ≥30 recipes × 4 slots; cutting 10x brings the worst case to ≤1.5s with
no measured plan-quality loss (52 algorithm tests green at the new cap).
The recency penalty is `MEAL_PLAN_RECENCY_PENALTY = 100` (not the earlier
40) — both constants live in `src/lib/nutrition/mealPlanAlgo.ts`, the single
shared module imported by web (`src/lib/planning/generateMealPlan.ts`) and
mobile.

### Step 3: Review Plan
```
Each day shows:
  → Day title + total calories
  → Per-macro indicators: P/C/F with ✓ (within 15%), +N (over), -N (under)
  → Per-meal: slot name, recipe title, portion if != 1x, macros (kcal/P/C/F)
  → Tap meal → navigates to recipe with ?portion=X for adjusted quantities
  → + icon → logs meal directly to today's tracker
  → Long-press meal → swap with alternative from library
```

A **smart suggestions card** (scores library/discover recipes for the plan,
with a save CTA) and a **week summary card** ("Hits your targets N of M
days", worst-short-day diagnosis, coloured by win/progress/calm tone) render
alongside the day cards once a plan exists — both draw on the same scorer
described in [Loops](#loops) below. Flag `plan_web_parity_v1`, default-ON.

### Step 4: Generate Shopping List → hand off to Shopping

Generating a shopping list is the **next step in this loop, not part of this
doc**. In short: "Generate Shopping List" aggregates every planned recipe's
ingredients, merges duplicate quantities (count↔weight folds to grams only
at high confidence — never guesses a low-confidence weight), categorises by
aisle, and persists to the canonical **`shopping_items`** table (`shopping_lists`
is a legacy JSON-blob table, renamed to `shopping_lists_legacy` after the
2026-04-13 relational migration — it is a pre-migration fallback read path
only, never the write target for new lists). Plan edits (add/remove/swap)
keep the list in sync afterwards without wiping a household-mate's in-progress
shop.

Full detail — persistence, merge rules, sync-on-edit, household attribution,
checking off items — lives in **[shopping-list.md](shopping-list.md)**. The
two sections directly below cover the plan-side half of that sync contract
(what a plan edit does to the list); read them here if you're working on
Plan-tab code, and read shopping-list.md for the Shopping surface itself.

## Add to Shopping List from a Recipe

The shopping list also fills **directly from a single recipe**, not just the
plan. The recipe detail surface (web `RecipeDetail`, mobile `recipe/[id]`)
carries an **"Add to shopping list"** action below the ingredient grid.

**Flag:** `recipe_shopping_list_v1` — **default-ON** (`REDESIGN_DEFAULT_ON` on
web + mobile; PostHog kill switch). Off → the action is hidden and the list
stays plan-only.

```
"Add to shopping list" button:
  → Parses the recipe's ingredient lines (scaled by the servings stepper)
  → Reads the user's LIVE shopping_items for their scope (solo / household)
  → Merges in memory (shared appendRecipeToShoppingList):
      • same ingredient + unit → sum quantity, append source
      • count vs weight, same ingredient → fold to grams ONLY at high
        confidence (measureToGramsConfidence); else keep separate rows
        (never guesses a weight on a low-confidence conversion)
  → Persists ONLY the delta: UPDATE merged rows (preserves `checked`),
    INSERT new rows (never delete-and-replace — won't clobber checked
    rows or a household-mate's items)
  → Calm "building your list" toast/alert ("Added 3 ingredients — merged
    2 you already had"); no health claims (lists are ingredients)
```

Unlike Step 4's plan generation (full delete-and-replace), this **appends and
merges** so a recipe never wipes a list the user is mid-shop on. Logic is the
shared, pure `src/lib/planning/appendRecipeToShoppingList.ts` +
`appendRecipeToShoppingListClient.ts` (imported by mobile via `@suppr/shared`).

Analytics: `recipe_shopping_list_added` fires with
`{ recipeId, ingredientCount, addedCount, mergedCount, platform }`.

## Keep the Shopping List in Sync as the Plan Is Edited

Adding / removing / **swapping** a meal in the Plan now keeps the shopping list
in sync, without the explicit "Generate Shopping List" tap and **without** Step
4's full delete-and-replace. It closes the loop from the *other* direction:
the previous section fed the list from a single recipe; this one keeps the
list tracking the plan as the plan changes.

**Flag:** `plan_shopping_sync_v1` — **default-ON** (`REDESIGN_DEFAULT_ON` on web
+ mobile; PostHog kill switch). Off → the legacy one-off list (the explicit
"Generate Shopping List" path only). Parity guard:
`tests/unit/planShoppingSyncFlagParity.test.ts`.

```
On a plan edit (add / remove / swap a meal):
  → Read the user's LIVE shopping_items for their scope (solo / household)
  → Apply the edit in memory (shared applyPlanEditToShoppingList):
      • add    → append + merge the recipe (the same aggregator described
                 above): same ingredient+unit sums, count↔weight folds to
                 grams ONLY at high confidence (else separate rows — never
                 guesses a weight)
      • remove → decrement ONLY that recipe's contribution; drop a row when it
                 hits ~zero AND no other recipe still sources it
      • swap   → remove the outgoing recipe, then append the incoming (one read),
                 so a shared ingredient nets correctly (not double-counted)
  → Persist ONLY the delta: UPDATE changed rows (preserves `checked`), INSERT
    new rows, DELETE rows the edit emptied — never delete-and-replace, so a
    checked-off row or a household-mate's manual addition is never clobbered
```

**Provenance = the existing `shopping_items.source` field** (comma-separated
recipe titles — the same tag the `shoppingItemsTiedToCurrentPlan`
reconciliation already reads). A row sourced only by the removed recipe is safe
to delete; a row still sourced by another recipe is decremented and kept. **No
schema change was needed** — the existing field already carried enough
information.

**Reuse (not reinvention):** the add side is the same
`appendRecipeToShoppingList` described above; the remove side is the new
`removeRecipeFromShoppingList` (its exact inverse — same normaliser, merge-key,
servings multiplier, and high-confidence count↔weight gate, extracted into
`shoppingMergePrimitives.ts` so both share one implementation). The engine is
`syncPlanEditToShoppingList.ts`; the persistence is
`syncPlanEditToShoppingListClient.ts`; the platform glue (ingredient fetch +
analytics) is `planShoppingSyncHost.ts` — all shared, imported by mobile via
`@suppr/shared`.

**Surfaces:** web — swap (`MealPlanner` `pickSwap` → `AppDataContext`
`syncShoppingListForPlanEdit`). Mobile — swap **and** "Remove from plan" (the
row-menu action) via `apps/mobile/lib/planShoppingSync.ts`. Web has no per-meal
"remove" affordance today (its meal-edit surface is swap-only), so only the swap
path is wired there; when a web remove lands it calls the same shared engine (the
context method already accepts `{ kind: "remove" }`). This is a pre-existing UI
divergence, not new drift.

Analytics: `plan_shopping_synced` fires with
`{ editKind, addedCount, mergedCount, decrementedCount, removedCount, platform }`
(same name web + mobile; no PII, no ingredient names).

## Named Plan Slots
Users can create, rename, and switch between multiple named plans (e.g. "This week", "Cut phase", "Bulk phase"). The active plan syncs to Supabase; **all other named slots live only in localStorage**. Switching devices or clearing browser data loses inactive slots. See [Data Schema — Client-only Data](../data/schema.md#client-only-data-localstorage) for details.

## Move Meals Between Days
Users can reorder meals without regenerating the plan.

- **Web**: drag a meal card onto any other slot (HTML5 drag-drop). The source and destination swap in place — if the destination slot was empty, the source becomes empty. A "Move" button on each card opens a keyboard-accessible fallback: enter `day,slot` (e.g. `2,1`). `aria-grabbed` + `aria-roledescription` expose drag state to screen readers.
- **Mobile**: the move is available via the meal action sheet (`Move` option). A long-press-drag gesture is deferred to a follow-up to avoid accidental drags during scroll.
- Analytics: `meal_moved_in_plan` fires with `{ fromSlot, toSlot, crossDay }`.

## Per-Meal Lock — "Refresh the rest"

Eat-This-Much-style "lock the ones you like, reroll the rest". Lets a user keep
the meals they're happy with and regenerate only the ones they're not.

**Flag:** `plan_meal_lock_v1` — **default-ON** (`REDESIGN_DEFAULT_ON` on web +
mobile; off via PostHog kill switch). Off → the legacy all-or-nothing
Regenerate, no lock affordance.

**Affordance:**
- Each populated, non-leftover meal row carries a **quiet lock glyph** (lucide
  `Lock` when locked / `LockOpen` when not), tinted muted/secondary — tap to
  toggle without leaving the row.
- The per-row action menu (web `DropdownMenu`) / action sheet (mobile `rowMenu`)
  gains **"Keep this meal"** (→ "Unlock this meal" when already locked) as a
  first-class action.

**Regenerate behaviour:**
- When **≥1 meal is locked**, the Regenerate CTA microcopy becomes
  **"Refresh the rest"** (web summary + bottom CTA; mobile primary CTA reads
  "Refresh the rest ▾").
- Regenerate then keeps every locked meal **byte-identical** and re-rolls only
  the **unlocked** slots, rebalancing the **remaining macro budget**
  (daily target − locked meals' macros) across them — so the day still aims at
  the full target, not the original per-slot share.
- Over-locked days (locked macros already exceed the target) floor the remaining
  budget at a small positive value, so the unlocked slots are minimised rather
  than breaking band maths.
- Locked recipes are excluded from the unlocked re-roll pool (no same-day dupe).
- The leftover-distribution pass is **skipped** in keep-locked mode — it
  re-samples downstream slots from a fresh whole-week view and would overwrite
  the locked rows.

**Persistence:** the lock lives on `DayPlanMeal.isLocked` / `PlanMeal.isLocked`
and persists in the **existing local plan JSON blob** (the named-slot `plan`
payload in localStorage / AsyncStorage). It is **NOT** stored in the relational
`meal_plan_meals` cloud table — a lock is a device-local planning affordance
(like the portion stepper), so no migration was added. Cross-device lock sync is
intentionally out of scope (not a gap).

**Core algorithm:** `regenerateUnlockedMeals<R>()` in
`src/lib/nutrition/mealPlanAlgo.ts` (shared web + mobile). Web wraps it as
`regeneratePlanKeepingLocked()` in `src/lib/planning/generateMealPlan.ts`; mobile
calls it inline from the Plan tab's generate path.

**Analytics:**
- `plan_meal_lock_toggled` (`{ locked, slot, lockedCount, platform }`) — fires
  on every lock/unlock, same name web + mobile.
- `plan_regenerated_partial` (`{ lockedCount, rerolledCount, days, platform }`) —
  fires on a "Refresh the rest" regenerate (distinct from `meal_plan_generated`).

## Make-anything-fit · Mode B — distribute-around-anchor

The proactive Plan-tab half of the make-anything-fit engine (spec:
`docs/specs/2026-06-02-make-anything-fit-engine.md`). Sibling of Mode A (the
Today portion-fit hint): same engine, different surface and question.

> Mode A (Today): *"given what's left, how much of THIS fits right now?"*
> Mode B (Plan): *"if I commit to THIS meal, what's my budget for the rest of the day?"*

When the user **locks a meal they want** into a plan day (the **anchor** — the
same `isLocked` flag the keep-locked regenerate uses, so the affordance is free),
a body-neutral band appears under that day card showing how the **remaining day
budget shakes out across the other open slots**.

**Flag:** `plan_distribute_anchor_v1` — **default-ON** (`REDESIGN_DEFAULT_ON` on
web + mobile — always flag on, so the solo tester sees it). Off → the legacy
day card with no band (the kill switch). Parity guard:
`tests/unit/planDistributeAnchorFlagParity.test.ts`.

**The band shows:**
- a body-neutral, enabling-framed summary line — *"Spag bol's in for dinner —
  here's how breakfast and lunch shake out."* — never a deficit instruction
  ("eat less"). The framing rule is the positioning (failure-mode #1 in the
  spec): every output enables the wanted food.
- per-open-slot **calorie budget chips** (`~480 kcal`), one per non-optional open
  slot. The optional **Snacks** slot keeps a budget for suggestion-scoping but is
  never shown as a named aim (mirrors `emptySlotAimKcal`'s policy — a number on a
  slot you may skip reads as a quota).

**Math:** `distributeAroundAnchor(targets, consumed, anchor, openSlots)` in
`src/lib/nutrition/distributeAroundAnchor.ts` (re-exported to mobile via
`@suppr/nutrition-core/distributeAroundAnchor`). It subtracts the anchor (and
anything already placed) from each macro's day budget — `remaining_macro =
target − consumed − anchor`, floored at 0 — then spreads the remainder across the
open slots by the **same dietitian weights** the planner uses (breakfast .25 /
lunch .3 / dinner .35 / snacks .1, normalised over the open slots). Every macro
(P/C/F + optional fibre) is distributed independently, so a **high-fat anchor
leaves a smaller fat remainder** → the other slots come out leaner on fat, not
merely smaller on calories ("macros, not just calories").

**Per-slot floors (failure-mode #3):** a slot whose calorie share falls below
`MODE_B_SLOT_FLOOR_KCAL` (150) is flagged `tooTight` and renders an honest
"barely room" chip rather than a fabricated tiny number; when **every**
non-optional open slot is below the floor, `anchorLeavesTooLittle` is true and
the copy says so plainly — *"The cake fills most of today — the other slots
barely have room, but it's your call."*

**Nutrition-trust rule (non-negotiable):** when the anchor's macros are
low-confidence (`macrosAreEstimated` — a kcal-only recipe coerced to a neutral
28/42/30 split), the engine returns a **qualitative** result and the copy never
names per-slot numbers — *"…here's roughly how the rest of the day shakes out."*
No fabricated budget off a guessed split.

**No-negative invariant:** an over-budget anchor (or an over-logged day) can never
hand a slot a negative or inflated budget — every macro remainder is floored at 0;
NaN/negative inputs clamp to 0.

**Host wiring (net-neutral, screen-budget-PINNED hosts):** the shared selector
`planDayDistributeAroundAnchor(meals, targets)` derives the anchor (the locked,
non-placeholder meal), treats other placed meals as consumed, and uses
placeholder slots as the open slots — so each host adds only one import + one
`<PlanAnchorBudgetBand />` call. Web band:
`src/app/components/suppr/plan-anchor-budget-band.tsx`; mobile band:
`apps/mobile/components/plan/PlanAnchorBudgetBand.tsx`; hosts
`src/app/components/MealPlanner.tsx` + `apps/mobile/app/(tabs)/planner.tsx`.

**Tests:** `tests/unit/distributeAroundAnchor.test.ts` (distribution math,
per-slot floors, the too-little case, macros-not-just-calories, the no-negative
invariant, the low-confidence qualitative gate, the host selector, and the
body-neutral copy) + the flag-parity test above.

## Save Plan as Template
A whole week — or any 1–7 day slice — can be saved as a named template (e.g. "Bulk week", "Vacation week"). Templates persist server-side in `user_plan_templates`.

- "Templates" button in the planner header opens a two-tab dialog/sheet: **Save as template** (name + day-count selector) and **My templates** (list with Apply + Delete).
- Applying overwrites the current week's plan — the user confirms first.
- **Empty weeks fail loudly**: saving when no eligible meals exist shows the inline error "This plan has no meals to save." No silent success, no accidental blank templates.
- Leftover slots are not persisted in templates — they are re-derived on apply (since a template applied to a different week may hit different yields if recipes changed).
- Analytics: `plan_template_created` (`{ dayCount, slotCount }`), `plan_template_applied`.

## Leftovers-Aware Generation
When the planner generates a plan, any meal whose recipe yields more than one serving triggers a "leftover of X" fill on subsequent matching slots.

- **Matching slots**: dinner leftovers land in next-day lunch/dinner; lunch leftovers in lunch/dinner; breakfast yields in breakfast/snack; snack yields in snacks. Occupied slots are never overwritten.
- Leftover slots display a `🍱 Leftover of [recipe]` badge. Their macros **equal the parent's scaled macros** — the flag is purely visual.
- Swapping or unlocking a parent triggers a confirm: "This will remove N leftover meals." Confirming clears the downstream copies and recomputes day totals.
- Yields of 1 produce no leftovers — ordinary single-serving recipes behave as before.
- Analytics: `plan_leftovers_generated` (`{ parentCount, leftoverCount }`) fires once per generation when leftovers are filled.

## Plan Import — paste / PDF / photo (flag-gated, `plan_import_enabled` default-OFF)

A separate entry point lets a user bring an **existing** weekly plan into
Suppr instead of generating one: paste plan + recipe text (both platforms),
or upload a PDF/photo (**mobile only** — web is paste-only, PDF/photo is
Sprint 2 / not yet built). Text goes through AI parsing
(`/api/plan-import/parse`), each recipe's ingredients are run through
`verifyIngredients` with confidence-tiered "author's numbers" vs "match &
verify" nutrition modes, an optional auto-rebalance nudges linked-slot
portions toward a target, and the result can be saved as a template and/or
activated (replacing the current week, re-anchored to today).

**This is cut from the launch build** pending more testing — every entry
point on both platforms checks `isFeatureEnabled("plan_import_enabled")` and
is default-OFF. Do not describe this feature as shipped-safe; it is
implemented but deliberately unramped.

**Known limitation — mobile only:** `apps/mobile/app/plan-import.tsx`
hardcodes `const [userTargetKcal] = useState(2000)` (line 76) and, when
auto-rebalance runs in "match" mode, derives **fabricated** macro splits off
that fixed number — `protein = kcal * 0.075`, `carbs = kcal * 0.125`, `fat =
kcal * 0.035` (lines ~256–267) — then shows the user **"Your target 2000"**
in the review screen regardless of their real profile targets. A user on a
1,500 or 2,800 kcal goal gets their imported plan's portions rebalanced
against a fictional 2,000 kcal target and told it's "their target." This
directly violates the trust posture (nutrition estimates must be real, never
fabricated). **Web does not have this bug** —
`src/app/components/plan-import/usePlanImport.ts` seeds the same rebalancer
from `useAppData().nutritionTargets` (the user's actual calories/protein/
carbs/fat/fibre), with a code comment explicitly noting the fix: *"seed from
the user's actual macro targets rather than a placeholder."*

This is not a documented, accepted platform divergence — it is an unnoticed
mobile-only regression against the web implementation. It should be fixed
before `plan_import_enabled` is ever ramped past internal testing; the flag
being off today limits the blast radius, but the fix is still owed.

Shared pipeline (both platforms, once past the mobile-only hardcode):
`app/api/plan-import/parse/route.ts`, `src/lib/planning/planImport/*`
(compile/rebalance/commit/verify), `commitPlanImport`. Mobile-only extract
step for PDF/photo: `app/api/plan-import/extract/route.ts`. Planning doc:
`docs/planning/plan-import-linear-program.md`.

## Edge Cases
- Chosen plan source has 0 recipes (`library` mode at 0 saves) → Generate
  disables with a hint pointing back at the source selector; **this is no
  longer a dead end** on the default `library_and_discovery` source, which
  always has ≥1 recipe via Suppr's curated Discovery seeds (see Step 1
  above) — the older "No saved recipes → alert, save from Discover"
  behaviour only fires on the legacy pre-`plan_source_selector` path.
- < 4 recipes → some slots may repeat; recency penalty minimises this
- Meal type not tagged → treated as fitting any slot (legacy data)
- Profile targets not set → falls back to 2000/150/200/65 defaults
  (`src/constants/nutritionDefaults.ts`)

## Loops

This doc covers the **planning stage** of two product loops:

- **Plan the Week → Shop → Cook** — choose source/configure → **generate**
  (this doc) → adjust (lock/swap/move/distribute-around-anchor, this doc) →
  generate + sync a shopping list ([shopping-list.md](shopping-list.md)) →
  shop → cook. This doc is steps 1–3 of that loop; shopping-list.md picks up
  from "Generate Shopping List."
- **What to Eat Next (north-star / coach loop)** — the Today-tab "what to eat
  next" block and the `/coach` "What to eat next" ranked-candidate list share
  the **same scorer** the Plan tab's smart-suggestions card and week-summary
  card use (Step 3 above) — one recipe-fit engine, three surfaces. See
  [what-to-eat-next.md](what-to-eat-next.md) for the Today/coach
  side of that shared scoring logic.

## Related Documents
- [Journey: Shopping List](shopping-list.md) — where this loop goes next
- [Journey: Food Tracking](food-tracking.md)
- [Journey: What to Eat Next / North Star](what-to-eat-next.md)
- [Decision: meal-plan sampler cap 20k → 2k](../decisions/2026-04-25-meal-plan-sampler-cap.md)
- [Decision: plan source selector](../decisions/2026-05-31-plan-source-selector.md)
- [Decision: recipe → shopping list](../decisions/2026-06-30-recipe-to-shopping-list.md)
- [Decision: plan → shopping list sync](../decisions/2026-07-01-plan-to-shopping-list-sync.md)
- [Product: Overview — Feature areas](../product/overview.md#feature-areas)
- [Technical: Meal Planning Algorithm](../technical/architecture.md#meal-planning)
