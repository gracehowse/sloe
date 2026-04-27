# Decision log: density-aware totalGramsForVerifyScale (P0-2, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P0 #2 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). The 2026-04-24 sweep (T5) flagged that `totalGramsForVerifyScale` treats 1 ml as 1 g, under-scaling olive oil by ~9 % and over-scaling honey by ~42 %. The bug was pinned by deliberately-failing tests so CI stayed green; the underlying error was live in production.

---

## Decision

`totalGramsForVerifyScale` is now **density-aware** with an explicit refusal path. Resolution priority:

1. `chosenPortion.gramWeight` when present and not the trivial `{label:"ml", gramWeight:1}` placeholder used by STANDARD_UNITS in the verify screen.
2. `options.gPerMl` when supplied by the caller.
3. `densityForName(ing.name)` via the STAPLES table in `src/lib/nutrition/estimateIngredientMacros.ts` (olive oil 0.92, honey 1.42, water 1.00, etc.).
4. **Refused** — function returns `{ grams: 0, densityRefused: true }` when unit is `ml` and none of the above resolve. Caller surfaces a "needs density — switch to g/oz" hint.

The legacy single-return form `totalGramsForVerifyScale(): number` is preserved for backwards compatibility; new callers should prefer `totalGramsForVerifyScaleDetailed()` for the flag.

## Rationale

The pre-fix function silently treated every ml input as if 1 ml = 1 g. That's correct only for water (and approximately for stocks). For the user's most common liquid ingredients:

- Olive oil ≈ 0.92 g/ml → kcal under-scaled by ~9 %.
- Whole milk ≈ 1.03 g/ml → kcal over-scaled by ~3 %.
- Honey ≈ 1.42 g/ml → kcal over-scaled by ~42 %.
- 40 % ABV spirits ≈ 0.95 g/ml → kcal under-scaled by ~5 %.

A user verifying a recipe sees a precise calorie number that is wrong by inspection. That contradicts the best-in-class Pillar 2 ("Never imply precision you don't have") more visibly than any other open bug, because the user could trivially break the claim with one olive-oil scan.

The `STAPLES` table in `estimateIngredientMacros.ts` already carries `gPerMl` for the common liquids — the data was there, it just wasn't reused on the verify screen. The fix exports a thin `densityForName(name)` helper and threads it through `totalGramsForVerifyScale`. No new data table; no new external dependency.

The "refuse rather than guess" branch follows the project non-negotiable: if nutrition is uncertain, do not guess. A user verifying "100 ml of [unmatched food]" now sees `needs density — switch to g/oz` instead of a silent 100 g pass-through. Verify screen will route them to a g/oz portion.

## Alternatives considered

- **Default to gPerMl = 1.0 (water) with a `densityDefaulted` flag and ship a banner.** Rejected. Water-default is exactly the previous bug with extra UI. Refusal is cleaner.
- **Block the verify screen from offering ml at all when STAPLES misses.** Considered. Worth doing as a follow-up — the STANDARD_UNITS array in `verify.tsx` could omit ml when no density resolves. Out of scope for P0-2; tracked.
- **Extend STAPLES to cover every liquid we see.** Required regardless of the above. Out of scope here; STAPLES expansion is owned by `nutrition-engine`. The current 30+ entries cover the common cases.
- **Compute density from the matched USDA / OFF row when available.** Right long-term answer; depends on the food-source pipeline carrying density through. Tracked as a follow-up; the current fix is sufficient because the staple table covers the common verify-screen cases.

## Implementation

- `src/lib/nutrition/estimateIngredientMacros.ts` — new export `densityForName(name): number | undefined`. Wraps `stapleForName`.
- `src/lib/nutrition/totalGramsForVerifyScale.ts` — rewritten. New return shape via `totalGramsForVerifyScaleDetailed`; legacy `totalGramsForVerifyScale` preserved. `VerifyScaleIngredient` now accepts optional `name`.
- `apps/mobile/lib/verifyRecipe.ts` — re-exports `totalGramsForVerifyScaleDetailed` and `VerifyScaleResult`.
- `apps/mobile/app/recipe/verify.tsx` — `Amount` row renders `needs density — switch to g/oz` (in `Accent.warning` amber) instead of `= 0 g` when ml refused.
- `tests/unit/totalGramsForVerifyScale.test.ts` — `it.fails(...)` markers flipped to `it(...)`. Eight new test cases cover priority order, name lookup, options override, trivial-placeholder routing, and refusal. **13/13 green.**
- `docs/product/nutrition-approximation-policy.md` §A2 — status flipped from KNOWN INCORRECT to FIXED. Workaround section updated to direct authors to STAPLES expansion or g/oz portion fallback.

## Platforms affected

- **Mobile:** `apps/mobile/app/recipe/verify.tsx` render hint, `apps/mobile/lib/verifyRecipe.ts` re-export.
- **Web:** no current consumer of `totalGramsForVerifyScale`. Function lives in `src/lib/nutrition/` so any future web consumer (e.g. a web verify screen) gets density-awareness for free.
- **Supabase:** none. Pure logic + tests + docs.

## Verification

- `tests/unit/totalGramsForVerifyScale.test.ts` 13/13 green.
- Sibling tests `tests/unit/estimateIngredientMacros.test.ts` (35) + `tests/unit/measureToGrams.test.ts` (56) + `tests/unit/macroPlausibility.test.ts` (9) all green — no regressions in the rest of the nutrition core.
- Web `tsc --noEmit` clean for touched files.
- Mobile `tsc --noEmit` clean for touched files.
- Grace runs `npm run ci` at end-of-P0-band hand-off.

## Related artefacts

- [P0 punch list](../audits/2026-04-25-opus47-codebase-review.md#7-prioritized-punch-list)
- [Nutrition approximation policy §A2](../product/nutrition-approximation-policy.md#a2--ml-to-g-density-resolution-totalgramsforverifyscale)
- [2026-04-24 full-sweep audit T5](../audits/2026-04-24-full-sweep.md)

## Revisit when

- A new liquid ingredient is added to a recipe and STAPLES misses the density. Decision: extend STAPLES (preferred) or pass `options.gPerMl` from the caller.
- A web verify screen ships and needs the same hint UI.
- USDA / OFF food-source pipeline starts carrying density through; consider promoting that to first-priority over STAPLES.
