# Today empty meal slots → "Aim ~X kcal" (ENG-1092, increment 1)

**Date:** 2026-06-13
**Area:** Today tab / meals (web + mobile)
**Status:** Resolved (Grace approved the "Purposeful empties" prototype 2026-06-13)
**Flag:** `plan_today_aim_empty_v1` (in `REDESIGN_DEFAULT_ON` both platforms; off → bare empty slots + the mobile 0.55 dim).

## Context

First increment of the "Purposeful empties" redesign (spec: `docs/planning/2026-06-13-plan-meals-empty-slot-spec.md`). The Today per-slot rows (ENG-1095) showed only a name + "+" on empty slots — no purpose. This adds the Lifesum-validated recommended-calorie line.

## Decision

An empty Today meal slot now shows **"Aim ~X kcal"** in the exact spot a populated slot shows its macro chips, so empty and full cards share one rhythm. Empty slots also render at **full opacity** (the mobile 0.55 dim is dropped — it made empties look disabled; web never had it).

- **Copy "Aim ~X kcal"** (not "Recommended", not a range): a single tilde-value is honest (the budget helper returns one redistributed number — a ±band would be fabricated precision) and body-neutral (permission, not prescription). Design-panel call 2026-06-13.
- **Dynamic** via `distributeMealBudget(effectiveCalorieTarget, fiberTarget, consumedBySlot)` — already computed-and-discarded in the web component; now wired. Eaten calories redistribute across the still-empty slots, so partial-day aims shrink honestly.
- **The `calories:0` guard:** `distributeMealBudget` returns `calories: 0` for any slot with food, and `0` for empty slots once the day is at/over budget. The shared helper returns `null` in both cases so a slot never shows "Aim ~0 kcal"; callers also gate on `hasMeals === false`.
- **Optional slots show no aim (Snacks):** an aim on a slot the user may deliberately skip reads as a quota to fill (diet-culture / ED-adjacent). `emptySlotAimKcal` returns `null` for `Snacks`/`Snack`. Snacks stays in the budget ratios, so the three main meals' aims still leave ~15% implicit headroom — just unnamed.

## Sign-off (pre-ramp microcopy gate)

- **brand-manager (2026-06-13): APPROVE "Aim ~X kcal".** On-voice (permission, estimate-honest), and it deliberately rhymes with the existing under-ring coach line (`todayRoomForMeal` → "Aim for about X kcal") — "Aim" is the shared verb for Today's forward-headroom family; don't split it. Vetoed a conditional "~X if you snack" as off-voice (app second-guessing).
- **diversity-inclusion (2026-06-13): PASS-WITH-TWEAK** — the Snacks slot was the one gating finding (optional-slot quota pressure). Resolution (the option both sign-offs accept): suppress the aim on Snacks (above). Main meals ship as-is.
- Open follow-up (not blocking): a "quiet the numbers" opt-out for per-slot aims, folded into the future body-surface controls cluster (with hide-weight / streak toggles) — see the Linear issue under the Today-tab project.

## Shared spine (parity)

`src/lib/nutrition/mealSlotAim.ts` — `emptySlotAimKcal()` + `aimKcalLabel()` is the single source of the number AND the copy, imported by both Today components (and, next, Plan), so they can't drift. Mobile gains `effectiveCalorieTarget` / `fiberTarget` props (mobile host passes `effectiveCalorieGoal` ↔ web's `effectiveCalorieTarget`); each component computes `consumedBySlot` from its own grouped meals.

## Files

- `src/lib/nutrition/mealSlotAim.ts` (new shared helper)
- `src/app/components/suppr/today-meals-section.tsx` — web aim line
- `apps/mobile/components/today/TodayMealsSection.tsx` — mobile aim line + drop 0.55 dim + new target props
- `apps/mobile/app/(tabs)/index.tsx` — pass `effectiveCalorieTarget`
- `apps/mobile/lib/analytics.ts`, `src/lib/analytics/track.ts` — `plan_today_aim_empty_v1`
- Tests: `tests/unit/mealSlotAim.test.ts`

## Verified (SEE)

- **Web** (`/today --auth`, empty day): Breakfast Aim ~310 / Lunch ~370 / Dinner ~370 / Snacks ~185 (25/30/30/15 of the ~1,231 target).
- **iOS sim** (Today, future empty day): pixel-identical — same four aims at full opacity. Over-budget day (387 over): all aims correctly suppressed (the guard).
- Both typechecks + lints clean; aim helper suite (9) + wiring (3) + Today suites green.

## Next increments (same flag family)
- Plan day-card empty slots (`planner.tsx` / `MealPlanner.tsx`) — replace "Empty slot" / "No meals planned" with the same Aim rows (extract the shared `EmptyMealSlotRow` per platform + parity test).
- `plan_adjust_collapsed_v1` — web config-chip collapse (mobile already collapsed).
- **Pre-ramp:** route the "Aim ~X kcal" microcopy to brand-manager + diversity-inclusion (diet-culture perception).

## Related
- ENG-1095 — Today all-slots-always (the rows this enhances).
- Spec: `docs/planning/2026-06-13-plan-meals-empty-slot-spec.md`.
