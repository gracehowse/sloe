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
