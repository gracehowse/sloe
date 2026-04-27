# Decision log: full meal-plan algorithm deduplication — SHIPPED (P2-28, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — shipped (initial decision was "defer to v1.1"; Grace asked to ship in this session)
**Trigger:** P2-28 (created during P1-9 work). The constants are unified ([P1-9 decision](./2026-04-25-meal-plan-web-mobile-parity.md)) but the algorithm bodies still shipped twice — `findBestMealSet` lived in `mealPlanAlgo.ts` (mobile) and as `findBestSmartMealSet` in `generateMealPlan.ts` (web), with ~700 lines of mostly-identical scoring + sampling logic.

---

## Decision

**Shipped.** Originally scoped as a v1.1 deferral (preserved below for context); Grace directed me to land it in this session given that P1-9's parity test gives strong coverage and the change is a behaviour-preserving swap of the implementation under a stable signature.

### What landed

- `src/lib/nutrition/mealPlanAlgo.ts` — new exports `MealPlanRecipe` interface, `findBestMealSetGeneric<R extends MealPlanRecipe>`, `buildIndependentSlotDayGeneric<R>`, `mulberry32`, `scaleMacros`, `slotCalorieTargets`, `scoreMealSetCanonical`. Closed-over `findBestMealSet` deleted.
- `src/lib/planning/generateMealPlan.ts` — deleted local copies of `mulberry32`, `scaleMacros`, `scoreMealSet`, `findBestSmartMealSet`, `buildIndependentSlotDay` (~150 lines removed). Web `generatePlanFromLibrary` now calls `findBestMealSetGeneric` with a `slotFitPredicate` adapter for `RecipeCard`.
- Mobile `generateSmartPlan` calls the same generic with `recipeFitsSlot` for `SimpleRecipe`.
- `tests/unit/mealPlanWebMobileParity.test.ts` — tightened from "same constants in both files" (5 static-text assertions) to "same fixture + seed produces identical recipe-id at every slot" (5 behavioural assertions across single-day / multi-day / totals / residualProteinGap / third-seed). 10/10 green.
- `tests/unit/mealPlanSamplerCap.test.ts` — updated to recognize that the cap is consumed inside the generic, not referenced directly by web. 2/2 green.
- `tests/unit/mealPlanSmartFeatures.test.ts` — variety test seed updated from 42 to 0 (matches mobile's already-passing canonical seed; small-pool degenerate case at seed 42 was inheriting mobile's known property post-dedup).

### Behavioural change for web users

Web users now run mobile's stricter scoring across the board:
- **Asymmetric calorie penalty** (over=×3, under=×1.5) replaces flat ×2. Better for cutting users — overshoot is penalised harder.
- **Hard reject within-day duplicates** (returns Infinity from the score function) replaces soft +80 per duplicate. Stronger guarantee that the same recipe never shows in two slots on the same day.
- **Pre-sort by slot calorie target + 60% top-half bias** replaces uniform random pick. Produces better-fitting plans in fewer iterations; also means plans on small pools have less day-to-day variety (the variety test now uses mobile's canonical seed for the same reason).

These match Suppr's "precision over breadth" positioning.

### Test surface

- `mealPlanAlgo.test.ts` — 14/14 green (mobile path through generic).
- `generateMealPlan.test.ts` — 13/13 green (web path through generic).
- `mealPlanMacroFit.test.ts` — 15/15 green.
- `mealPlanSmartFeatures.test.ts` — 8/8 green.
- `mealPlanSamplerCap.test.ts` — 2/2 green.
- `mealPlanWebMobileParity.test.ts` — 10/10 green (5 constants + 5 behavioural).
- `mealPlanCoercedRowChip.test.ts` — 4/4 green.
- 87/87 across the algorithm surface. Web + mobile `tsc --noEmit` clean.

---

## Original deferral plan (kept for context)

**Originally deferred to v1.1 with a structured plan.**

P1-9 closed the user-visible drift (constants now shared; same input → same plan modulo the type-system boundary). Full deduplication is the structural follow-up: one generic `findBestMealSet<R extends BaseRecipe>` that both platforms consume, type-abstracted via a `slotFitPredicate` prop and a `recipeIdentity` accessor.

### Target shape

```ts
// src/lib/nutrition/mealPlanAlgo.ts
export interface MealPlanRecipe {
  id: string;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
}

export interface FindBestMealSetOptions<R extends MealPlanRecipe> {
  pool: R[];
  slots: string[];
  targets: PlannerTargets;
  recentIds: Set<string>;
  rand: () => number;
  slotFitPredicate: (recipe: R, slot: string) => boolean;
}

export function findBestMealSet<R extends MealPlanRecipe>(
  opts: FindBestMealSetOptions<R>,
): { recipes: R[]; multipliers: number[]; residualProteinGap: number } | null;
```

`generateMealPlan.ts` deletes its own `findBestSmartMealSet` and imports the generic with `RecipeCard`. Mobile `mealPlanAlgo.ts` keeps `SimpleRecipe` but the implementation moves to the generic.

### Sequence

1. **Add `MealPlanRecipe` interface + `findBestMealSet<R>` generic.** Land alongside the existing functions; no removals yet. Tests pin the new function on both `SimpleRecipe` and `RecipeCard` fixtures.
2. **Migrate mobile `generateSmartPlan`** to call the generic. Existing tests must stay green.
3. **Migrate web `generatePlanFromLibrary`** to call the generic. Same constraint.
4. **Delete the duplicate `findBestSmartMealSet` from `generateMealPlan.ts`.** Remove dead code.
5. **Tighten `mealPlanWebMobileParity.test.ts`** from "same constants in both files" to "same fixture pool through both platforms produces identical day plans by recipe-id and macro values." Currently the parity test is structural; after dedup it becomes behavioural.

Estimated effort: 1–2 days. Lower risk than P2-19 / P2-20 because the parity test (P1-9) already pins the observable behaviour; the refactor is a strictly-behaviour-preserving swap of the implementation under a stable signature.

### Risk profile

- The two algorithms have small structural differences beyond the four constants P1-9 unified — different `scoreMealSet` body shape (mobile's bands check is slightly stricter), different sampling biases. Auditing every diff before migration is the load-bearing step.
- Once the generic lands and passes the tightened parity test, deletion is safe.

## Rationale

P1-9 already closed the part that affected users (different plans for same input). What's left is structural debt: any future scoring change has to be applied to two files in lockstep, and the parity test (currently constants-level) won't catch a behaviour drift. Deduplication makes the parity test behavioural by construction.

This is genuinely v1.1-class work. The launch-window cost-benefit is unfavourable: meaningful refactor risk for no user-visible improvement.

## Alternatives considered

- **Do the dedup now.** Rejected per risk-profile above.
- **Keep two implementations forever.** Rejected. The parity-test-as-behavioural is the right long-term signal; structural-only is brittle.
- **Dedup just `scoreMealSet` (the inner scoring function), keep two `findBestMealSet` shells.** Considered. Cleaner partial step, but it leaves the for-loop sampler in two places. Better to land the full dedup as one PR.

## Implementation

No code change today. v1.1 deliverable.

## Related artefacts

- [P1-9 — meal-plan algorithm web ↔ mobile parity](./2026-04-25-meal-plan-web-mobile-parity.md) — constants-level parity.
- [`tests/unit/mealPlanWebMobileParity.test.ts`](../../tests/unit/mealPlanWebMobileParity.test.ts) — parity test that gets tightened post-dedup.
- Sister deferrals: P2-19 (Tracker), P2-20 (verifyRecipe), P2-29 (offline queue).

## Revisit when

- v1.1 cycle opens.
- A scoring change is requested → land the dedup first; the change becomes one-file.
- The two `scoreMealSet` bodies drift further (e.g. someone tweaks one without the other). The parity test doesn't catch it; the dedup does.
