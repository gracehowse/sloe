# User Journey: Meal Planning

**Audience:** Product / Design

## Overview
User generates a macro-aware meal plan from their saved recipes, with configurable slots, portion scaling, and the ability to swap, log, and generate a shopping list.

## Entry Points
- Plan tab on the bottom navigation

## Flow

### Step 1: Configure
```
Plan screen shows:
  → Number of saved recipes in library
  → Day selector: 1, 3, or 7 days
  → Meal slot toggles: Breakfast ✓, Lunch ✓, Snack ✓, Dinner ✓
    (toggle any off — e.g. exclude Snack)
  → "Generate Plan" button
```

### Step 2: Generate
```
Tapping Generate:
  → Fetches profile targets from Supabase (calories, protein, carbs, fat)
  → Runs generateSmartPlan() with:
    - Saved recipes + their meal_type tags
    - Enabled slots
    - Profile targets
  → Algorithm per day:
    1. Filter recipes by meal type per slot
    2. Sample 20K combinations with per-day unique seed
    3. Compute portion multipliers (0.5x-2x) per slot calorie target
    4. Score against macro targets (protein weighted 4x)
    5. Heavy recency penalty (40/recipe) for variety across days
  → Returns DayPlan[] with meals, multipliers, totals
  → Persists to Supabase meal_plans table
```

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

### Step 4: Generate Shopping List
```
"Generate Shopping List" button:
  → Fetches all recipe_ingredients for planned recipes
  → Merges quantities (2x chicken breast → combined weight)
  → Categorises by grocery section
  → Upserts to Supabase shopping_lists table
  → Navigates to /shopping
```

## Add to Shopping List from a Recipe (ENG-943)

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

Decision: [`docs/decisions/2026-06-30-recipe-to-shopping-list.md`](../decisions/2026-06-30-recipe-to-shopping-list.md).

## Named Plan Slots
Users can create, rename, and switch between multiple named plans (e.g. "This week", "Cut phase", "Bulk phase"). The active plan syncs to Supabase; **all other named slots live only in localStorage**. Switching devices or clearing browser data loses inactive slots. See [Data Schema — Client-only Data](../data/schema.md#client-only-data-localstorage) for details.

## Move Meals Between Days (Batch 3.10)
Users can reorder meals without regenerating the plan.

- **Web**: drag a meal card onto any other slot (HTML5 drag-drop). The source and destination swap in place — if the destination slot was empty, the source becomes empty. A "Move" button on each card opens a keyboard-accessible fallback: enter `day,slot` (e.g. `2,1`). `aria-grabbed` + `aria-roledescription` expose drag state to screen readers.
- **Mobile**: the move is available via the meal action sheet (`Move` option). A long-press-drag gesture is deferred to a follow-up to avoid accidental drags during scroll.
- Analytics: `meal_moved_in_plan` fires with `{ fromSlot, toSlot, crossDay }`.

## Per-Meal Lock — "Refresh the rest" (ENG-956)

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

## Make-anything-fit · Mode B — distribute-around-anchor (ENG-855)

The proactive Plan-tab half of the make-anything-fit engine (spec:
`docs/specs/2026-06-02-make-anything-fit-engine.md`). Sibling of Mode A (ENG-854,
the Today portion-fit hint): same engine, different surface and question.

> Mode A (Today): *"given what's left, how much of THIS fits right now?"*
> Mode B (Plan): *"if I commit to THIS meal, what's my budget for the rest of the day?"*

When the user **locks a meal they want** into a plan day (the **anchor** — the
same `isLocked` flag the keep-locked regenerate uses, so the affordance is free),
a body-neutral band appears under that day card showing how the **remaining day
budget shakes out across the other open slots**.

**Flag:** `plan_distribute_anchor_v1` — **default-ON** (`REDESIGN_DEFAULT_ON` on
web + mobile, per ENG-1279 "always flag on" so the solo tester sees it). Off →
the legacy day card with no band (the kill switch). Parity guard:
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

## Save Plan as Template (Batch 3.10)
A whole week — or any 1–7 day slice — can be saved as a named template (e.g. "Bulk week", "Vacation week"). Templates persist server-side in `user_plan_templates`.

- "Templates" button in the planner header opens a two-tab dialog/sheet: **Save as template** (name + day-count selector) and **My templates** (list with Apply + Delete).
- Applying overwrites the current week's plan — the user confirms first.
- **Empty weeks fail loudly**: saving when no eligible meals exist shows the inline error "This plan has no meals to save." No silent success, no accidental blank templates.
- Leftover slots are not persisted in templates — they are re-derived on apply (since a template applied to a different week may hit different yields if recipes changed).
- Analytics: `plan_template_created` (`{ dayCount, slotCount }`), `plan_template_applied`.

## Leftovers-Aware Generation (Batch 3.10)
When the planner generates a plan, any meal whose recipe yields more than one serving triggers a "leftover of X" fill on subsequent matching slots.

- **Matching slots**: dinner leftovers land in next-day lunch/dinner; lunch leftovers in lunch/dinner; breakfast yields in breakfast/snack; snack yields in snacks. Occupied slots are never overwritten.
- Leftover slots display a `🍱 Leftover of [recipe]` badge. Their macros **equal the parent's scaled macros** — the flag is purely visual.
- Swapping or unlocking a parent triggers a confirm: "This will remove N leftover meals." Confirming clears the downstream copies and recomputes day totals.
- Yields of 1 produce no leftovers — ordinary single-serving recipes behave as before.
- Analytics: `plan_leftovers_generated` (`{ parentCount, leftoverCount }`) fires once per generation when leftovers are filled.

## Edge Cases
- No saved recipes → alert with instructions to save from Discover
- < 4 recipes → some slots may repeat; recency penalty minimises this
- Meal type not tagged → treated as fitting any slot (legacy data)
- Profile targets not set → falls back to 2000/150/200/65 defaults

## Related Documents
- [Journey: Food Tracking](food-tracking.md)
- [Product: Feature Map](../product/overview.md#meal-planning)
- [Technical: Meal Planning Algorithm](../technical/architecture.md#meal-planning)
