# Decision log: meal-plan sampler cap 20k → 2k (P0-5, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P0 #5 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). The audit reported `generateSmartPlan` freezes the JS thread for 6–11 seconds on iPhone 12 / equivalent at pool ≥ 30 recipes × 4 slots, and that no `InteractionManager.runAfterInteractions` wrap existed at the call site.

---

## Decision

The mobile call site **already wraps** `generateSmartPlan` in `InteractionManager.runAfterInteractions` (`apps/mobile/app/(tabs)/planner.tsx:1181-1184`, shipped as T14 in the 2026-04-24 sweep). The audit and verifier missed it because the `await new Promise((resolve) => InteractionManager.runAfterInteractions(...))` pattern doesn't match a naive grep for the helper at the call site.

What was actually open was the sampler-effort cap. P0-5 closes it:

- Cap reduced from inline `20_000` → exported constant `MEAL_PLAN_SAMPLER_CAP = 2_000`.
- Constant lives in `src/lib/nutrition/mealPlanAlgo.ts` (mobile + shared) and is imported by `src/lib/planning/generateMealPlan.ts` (web). Single source of truth.
- Both files previously inlined `Math.min(20_000, perSlot.reduce(...))`; both now use `Math.min(MEAL_PLAN_SAMPLER_CAP, ...)`.
- Static test (`tests/unit/mealPlanSamplerCap.test.ts`) pins the value at 2_000 and asserts both files import the constant. Future regressions (re-introducing the literal, decoupling web from mobile, raising the cap silently) fail at PR time.

## Rationale

The 20k cap was producing a 6–11s blocking JS freeze on-device. With `InteractionManager.runAfterInteractions` already in place, the regenerate spinner paints, but the user still waits ~10 seconds without progress. Cutting the cap by 10× brings the worst case to ≤1.5 s on iPhone 12 / equivalent at the same pool size, which is well below the perceptual freeze threshold.

Plan-quality preservation: the sampler is not random uniform. Each slot's pool is pre-sorted by closeness to its calorie target (`sortedPerSlot` in `findBestMealSet`), and each iteration picks with a 60 % bias toward the top half. That is already a strong stratification; cutting the iteration count from 20 000 to 2 000 reduces the chance of finding a slightly-better tail-end combination but still explores the strong-fit region thoroughly. The 14 tests in `mealPlanAlgo.test.ts` plus 13 in `generateMealPlan.test.ts` plus 15 in `mealPlanMacroFit.test.ts` plus 8 in `mealPlanSmartFeatures.test.ts` (52 total) all pass at the new cap with no assertion changes — quality regressions would surface in the score-based assertions.

The 2_000 dial is intentionally conservative; if benchmarking shows we can safely go to 1_000 or 500 with a more aggressive top-half bias, that is a follow-up. Today's deliverable is "stop freezing the UI without measurable plan-quality loss."

## Alternatives considered

- **Move the sampler off the JS thread (Hermes worker / native module).** Rejected for now. Long-term right answer for a much bigger pool. Current pool sizes (≤ 200 recipes × ≤ 4 slots) don't justify the build complexity. Re-evaluate when discover-pool plans land (P2 territory).
- **Stratified sampling (slot-by-slot best-fit then random fill).** Considered; partially shipped already via the pre-sort + 60 % top-half bias. Going further would change the algorithm shape and require web ↔ mobile parity work (P1-9). Punted to that ticket.
- **Keep the 20_000 cap but raise pool size threshold for the mobile-only `runAfterInteractions` wrap.** Rejected. Wrap is already in place; the cap is the lever.

## Implementation

- `src/lib/nutrition/mealPlanAlgo.ts` — exported new constant `MEAL_PLAN_SAMPLER_CAP = 2_000`. `findBestMealSet`'s sample line now reads `Math.min(MEAL_PLAN_SAMPLER_CAP, perSlot.reduce(...))`. Header comment updated.
- `src/lib/planning/generateMealPlan.ts` — imports `MEAL_PLAN_SAMPLER_CAP` from `mealPlanAlgo`. Sampler line uses the constant. Comment cross-references the rationale.
- `tests/unit/mealPlanSamplerCap.test.ts` — new pin test. **2/2 green.**
- `apps/mobile/app/(tabs)/planner.tsx` — no change required. `InteractionManager.runAfterInteractions` wrap was already in place (T14, 2026-04-24).

## Platforms affected

- **Mobile:** sampler runs ~10× faster; existing UI thread wrap surfaces the regenerate spinner without delay.
- **Web:** sampler runs ~10× faster; web didn't have a UI freeze symptom (browser scheduler cooperates better) but parity matters for plan stability.
- **Supabase:** none.

## Verification

- `tests/unit/mealPlanSamplerCap.test.ts` — 2/2 green.
- `tests/unit/mealPlanAlgo.test.ts` — 14/14 green at the new cap (no assertion changes).
- `tests/unit/generateMealPlan.test.ts` — 13/13 green at the new cap.
- `tests/unit/mealPlanMacroFit.test.ts` — 15/15 green.
- `tests/unit/mealPlanSmartFeatures.test.ts` — 8/8 green.
- 52/52 across the meal-plan algorithm surface.

Pending: on-device benchmark (iPhone 12, pool=30, slots=4) to confirm ≤ 1.5 s end-to-end. Ship under TestFlight; instrument via the existing `generateStartMs` / `Date.now()` measurement at the call site (`apps/mobile/app/(tabs)/planner.tsx:1180`); review on next session.

## Related artefacts

- [P0 punch list](../audits/2026-04-25-opus47-codebase-review.md#7-prioritized-punch-list)
- [src/lib/nutrition/mealPlanAlgo.ts](../../src/lib/nutrition/mealPlanAlgo.ts)
- [src/lib/planning/generateMealPlan.ts](../../src/lib/planning/generateMealPlan.ts)
- [P1-9 — unify meal-plan algorithm web ↔ mobile](#) (the deeper algorithm-divergence work; sampler-cap parity is now covered by P0-5)

## Revisit when

- Pool sizes meaningfully grow (>500 recipes per user, e.g. discover-pool plans).
- On-device benchmarks show the 2 k cap exceeds 1.5 s on a low-end device — drop to 1 k.
- The sampler scoring function changes (e.g. P1-9 unification) — re-confirm plan quality at the new cap.
