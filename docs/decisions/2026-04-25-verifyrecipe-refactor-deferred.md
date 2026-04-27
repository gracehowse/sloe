# Decision log: apps/mobile/lib/verifyRecipe.ts decomposition — deferred to v1.1 (P2-20, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — deferred to v1.1 with structured plan
**Trigger:** P2-20 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). `apps/mobile/lib/verifyRecipe.ts` is ~1100 lines orchestrating multi-source nutrition matching (USDA, OFF, Edamam, FatSecret, custom foods, local estimation), scaling, and conflict resolution.

---

## Decision

**Deferred to v1.1 with a structured decomposition plan.**

The file is the brain of the recipe-verify pipeline. Every food the user verifies passes through it. Refactoring it pre-launch under time pressure would make any regression hit every recipe verify, which is on Suppr's hottest correctness path (verify is where Pillar 2 honesty is enforced).

The plan for v1.1:

### Target shape

Three modules in `apps/mobile/lib/verifyRecipe/`:

1. **`verifyIngredients.ts`** — orchestrator. Takes a list of parsed ingredient lines, returns verified `IngredientVerification[]`. ~300 lines. The current file's `verifyOneIngredient` and `verifyAllIngredients` move here.
2. **`resolveNutritionConflict.ts`** — when a single ingredient hits multiple sources (e.g. USDA + OFF), pick the best one. Currently inlined as decision branches in `verifyOneIngredient`. ~200 lines.
3. **`scaleAndFallback.ts`** — when no source returns a confident match, scale the local estimator. Currently inlined; ~150 lines.

Plus the existing re-exports (`totalGramsForVerifyScale`, `scaleMacros`, `fetchIngredientsForVerification`, `saveVerifiedIngredients`, etc.) stay at the package root for back-compat.

### Sequence

1. **Extract pure helpers first.** `parseIngredientForSearch`, `formatMealSourceLabelForRow`, `sourceLabel` — already pure, just colocated. Move to `verifyRecipe/helpers.ts`. Behaviour-preserving; tests cover them.
2. **Extract `scaleAndFallback`.** Pure function: takes `(name, amount, unit)` and returns macros via the local STAPLES table. Easy to test in isolation.
3. **Extract `resolveNutritionConflict`.** Returns a single source choice given a candidate-set. Keep the existing scoring logic; add tests for each tie-breaker.
4. **Refactor `verifyOneIngredient` to the new shape.** This is the load-bearing change; risk = a regression in the source-priority order. Snapshot tests on a fixture set of 20 representative ingredients (including the bug classes the prior audits fixed: silken tofu, olive oil density, chili crisp).
5. **Update the consumer file**, `apps/mobile/app/recipe/verify.tsx`. Imports change shape; behaviour shouldn't.

Estimated effort: 2–3 days plus a week of TestFlight bake-in (verify-screen behaviour is sensitive enough to warrant the same caution as P2-19).

### Risk profile

- **Steps 1–3** are safe behaviour-preserving moves.
- **Step 4** is where the risk concentrates. Pin every existing test that touches `verifyOneIngredient` (`tests/unit/verifyIngredients.test.ts`, `tests/integration/verify-ingredients-fatsecret-mock.test.ts`, etc.) AS-IS at the new module boundary. If any test changes shape or expected output, that's a regression.
- **Step 5** is mechanical.

## Rationale

The 1100-line file works correctly today. Test coverage is good. The cost of NOT refactoring is one extra mental hop when adding a new source (today: edit the orchestrator + scoring + scaling in one file; ideal: edit one of the three modules). That's annoying but not blocking — the file has been added to without crisis since 2026-03.

The cost of refactoring badly is a regression in the recipe-verify pipeline, which is the single most user-felt correctness surface in Suppr. Pre-launch sequencing is wrong; v1.1 with TestFlight bake-in is right.

## Alternatives considered

- **Do the refactor now.** Rejected. Risk profile too high pre-launch.
- **Do Step 1 (extract helpers) only.** Considered. Useful but stranded — without Step 4 the orchestrator stays monolithic. Better as one focused v1.1 PR.
- **Don't refactor at all.** Rejected. The 1100-line ceiling is a real hire-onboarding pain point and a real "where do I add the next source" pain point. v1.1 is the right time to land it.

## Implementation

No code change today. The plan above is the v1.1 deliverable.

## Related artefacts

- [Opus 4.7 codebase review §4.2](../audits/2026-04-25-opus47-codebase-review.md) (P2-20)
- [`apps/mobile/lib/verifyRecipe.ts`](../../apps/mobile/lib/verifyRecipe.ts) — current state.
- Sister deferrals: P2-19 (Tracker), P2-28 (planner algo), P2-29 (offline queue).

## Revisit when

- v1.1 cycle opens. All four heavy refactors (P2-19, P2-20, P2-28, P2-29) become eligible.
- A new ingredient source ships (e.g. Open Foods UK, Edamam Nutrition API v2). Refactor first; add the source on top.
- The orchestrator reaches 1500+ lines — that's the trigger to bring the refactor forward regardless of release cycle.
