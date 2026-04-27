# Decision log: meal-plan algorithm web ↔ mobile parity (P1-9, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved
**Trigger:** P1 #9 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Both `src/lib/nutrition/mealPlanAlgo.ts` (mobile) and `src/lib/planning/generateMealPlan.ts` (web) carried `SYNC NOTE` comments saying their algorithms must stay identical, but the constants drifted.

---

## Decision

The two algorithms still live in separate files (full deduplication is tracked as **P2-28** below — it's an architecture refactor, not a P1 fit). What's now genuinely synced are the four constants that determined "different plan for the same input":

| Constant | Pre-fix mobile | Pre-fix web | Post-P1-9 |
|---|---|---|---|
| `MEAL_PLAN_RECENCY_PENALTY` | inline `+100` | inline `+40` | **shared `100`** |
| `MEAL_PLAN_RECENCY_RESET_DAYS` | inline `% 5` | inline `% 3` | **shared `5`** |
| `DEFAULT_PLANNER_BANDS.calorieBandPct` | hardcoded `5` at planner.tsx call site | `12` in DEFAULT_PLANNER_BANDS | **shared `5`** |
| `DEFAULT_PLANNER_BANDS.carbFatBandPct` | hardcoded `15` at planner.tsx call site | `18` in DEFAULT_PLANNER_BANDS | **shared `15`** |

Plus a smaller correctness fix:

- `scaleMacros` in `mealPlanAlgo.ts` was rounding protein/carbs/fat to integer; web's `scaleMacros` was rounding to one decimal. Mobile now matches web (one decimal). Effect on day plans: imperceptible (rounding diff ≤ 0.5g per macro per meal); the value was pure consistency.

All four constants now live in `mealPlanAlgo.ts` and are imported by `generateMealPlan.ts`, the mobile planner call site, and the mobile lib re-export. The parity test (`tests/unit/mealPlanWebMobileParity.test.ts`) pins the values AND runs static-text assertions over both source files to catch a regression where someone re-introduces a divergent literal (e.g. drops `MEAL_PLAN_RECENCY_PENALTY` and types `40` again).

## Rationale

The CLAUDE.md non-negotiable is "web and mobile must stay in sync at all times." With the divergent constants in place, the same user with the same recipes and the same targets generated different plans on web vs mobile. Specifically:

- Mobile's `+100` recency penalty over web's `+40` made mobile much more aggressive about avoiding repeated recipes day-to-day.
- Mobile's 5-day reset over web's 3-day reset meant the first 5 days of a 7-day plan were unique on mobile, but only the first 3 on web.
- Mobile's tighter 5%/15% bands meant mobile's plans pushed harder toward exact macro targets; web's 12%/18% bands gave the planner more slack.

Adopting mobile's stricter values across the board reflects Suppr's core pitch ("precision over breadth"). It also avoids a regression for existing mobile users who have been getting these values; the web users who upgrade to the tighter bands will see plans that hit their targets more accurately, which is the value prop.

Full algorithm deduplication (one `findBestMealSet` shared by both, type-abstracted over `SimpleRecipe` and `RecipeCard`) is the right long-term move but a meaningful refactor — it's now **P2-28** in the post-launch backlog. Today's deliverable is the constants-level parity that makes "same input → same plan" true for the part of the algorithm that actually differs in observable behaviour.

## Alternatives considered

- **Full deduplication now.** Rejected for the launch window. Would touch ~700 lines across both files plus the type-abstraction work; non-trivial regression surface. The constant-level parity gets ≥ 90% of the user-visible benefit at a fraction of the risk.
- **Adopt web's looser values (12/18, recency +40, reset every 3 days).** Rejected. Suppr's positioning is precision over breadth; loosening the bands moves us toward MFP territory where targets are aspirational rather than enforced.
- **Pick a middle ground (e.g. 8/16 bands, +70 recency, 4-day reset).** Rejected. No principled basis to choose, and would regress mobile users whose existing plans were tuned at 5/15.

## Implementation

- `src/lib/nutrition/mealPlanAlgo.ts` — added exports `MEAL_PLAN_RECENCY_PENALTY = 100`, `MEAL_PLAN_RECENCY_RESET_DAYS = 5`, `DEFAULT_PLANNER_BANDS = { calorieBandPct: 5, carbFatBandPct: 15 }`. Updated `scoreMealSet` line 218 and the day-loop reset at line 638 to use the constants. `scaleMacros` rounds P/C/F to one decimal.
- `src/lib/planning/generateMealPlan.ts` — imports the four shared constants. Old local `DEFAULT_PLANNER_BANDS` literal replaced with `export const DEFAULT_PLANNER_BANDS = SHARED_DEFAULT_PLANNER_BANDS` (re-export). Recency penalty in `scoreMealSet` (was `+40`) and the day-loop reset (was `% 3`) now reference the shared constants.
- `apps/mobile/app/(tabs)/planner.tsx` — imports `DEFAULT_PLANNER_BANDS` from `@/lib/mealPlanAlgo`. Targets object reads `calorieBandPct: DEFAULT_PLANNER_BANDS.calorieBandPct` instead of inline `5`.
- `apps/mobile/lib/mealPlanAlgo.ts` — re-exports `DEFAULT_PLANNER_BANDS`, `MEAL_PLAN_RECENCY_PENALTY`, `MEAL_PLAN_RECENCY_RESET_DAYS`, `MEAL_PLAN_SAMPLER_CAP`.
- `tests/unit/mealPlanWebMobileParity.test.ts` — new. **8/8 green.** Asserts the constants match the canonical values, that web's `DEFAULT_PLANNER_BANDS` IS the mobile constant by reference equality, and that no divergent literals (`+= 40`, `% 3`, `calorieBandPct: 12`, etc.) survive in either source file.

## Platforms affected

- **Web:** `DEFAULT_PLANNER_BANDS` tightens from 12/18 to 5/15. Web users who haven't supplied per-call overrides will see the planner enforce stricter target adherence. Recipes that previously fell inside a wide band may now report as off-target (they always were; the band was just generous). Recency penalty quadruples; less repetition on multi-day plans.
- **Mobile:** behaviour unchanged at the constant values, but constants now imported from a shared location. `scaleMacros` rounds to one decimal (was integer); imperceptible to users.
- **Supabase:** none.

## Verification

- `tests/unit/mealPlanWebMobileParity.test.ts` — 8/8 green.
- `tests/unit/mealPlanAlgo.test.ts` — 14/14 green (no regressions).
- `tests/unit/generateMealPlan.test.ts` — 13/13 green (no regressions; web's stricter bands didn't break any existing assertions because tests use explicit targets).
- `tests/unit/mealPlanMacroFit.test.ts` — 15/15 green.
- `tests/unit/mealPlanSmartFeatures.test.ts` — 8/8 green.
- `tests/unit/mealPlanSamplerCap.test.ts` — 2/2 green.
- 60/60 across the meal-plan algorithm surface.
- Web + mobile `tsc --noEmit` clean.

## Related artefacts

- [Opus 4.7 codebase review §3.2](../audits/2026-04-25-opus47-codebase-review.md#32-web--mobile-planner-algorithm-divergence)
- [2026-04-24 full-sweep audit C8](../audits/2026-04-24-full-sweep.md)
- [P0-5 sampler cap decision](./2026-04-25-meal-plan-sampler-cap.md) — the first piece of mealPlanAlgo / generateMealPlan parity (`MEAL_PLAN_SAMPLER_CAP`)
- [P2-28 — full meal-plan algorithm deduplication](#) (new task added to roadmap; placeholder until the refactor lands)

## Revisit when

- The deduplication refactor (P2-28) lands — at that point the parity test should tighten to assert "same input through both algorithms produces the same plan" rather than "same constants in both files".
- A new band default needs to differ between platforms (e.g. web users want a "loose plan" toggle in the UI). Add a per-call override path rather than re-introducing a divergent default.
- Telemetry shows web users complaining about the new tighter bands. Consider a configurable preset.
