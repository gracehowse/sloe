# North-star block — "What to eat next"

**Status:** Phase 3 / B2.2 — shipped 2026-04-27; permanent-block screen
gate fixed 2026-06-17 (ENG-935)
**Authority:** D-2026-04-27-04 (north-star moment, permanent block)
**Spec:** `docs/specs/2026-04-27-production-design-spec.md` §A-northstar

## What it is

A permanent block on Today, second thing the eye lands on after the
calorie ring, that suggests one recipe from the user's library that
fits the calories + macros they have left for the slot they're in.

> "This is the single moment Suppr does what no competitor can.
> MacroFactor doesn't have your recipes. Mob/Paprika don't know
> your macros." — D-2026-04-27-04

## Component map

- **Scorer (shared lib):** `src/lib/nutrition/northStarSuggestion.ts`
  — `pickNorthStarSuggestion`, `pickNextNorthStarSuggestion`,
  `detectSlotForHour`, `ctaForSlot`, `bandLabel`,
  `NORTH_STAR_LIBRARY_MIN`, `isLibraryEligibleForNorthStar`,
  `NORTH_STAR_SLOT_SHARE`, `NORTH_STAR_NO_SLOT_SHARE` (ENG-995).
- **Web primitive:** `src/app/components/suppr/north-star-block.tsx`
  — four `kind` branches (`default` / `library-empty` /
  `over-budget` / `no-fit`).
- **Mobile primitive:** `apps/mobile/components/today/NorthStarBlock.tsx`
  — same four kinds + swipe-to-skip gesture (mobile only) with
  reduce-motion `X` button fallback.
- **Web host:** `NorthStarBlockHost` inside `NutritionTracker.tsx`
  picks the right `kind` based on remaining macros + library size, and
  threads `dailyCalorieTarget` (`effectiveCalorieTarget`) into the
  scorer for the per-meal budget.
- **Mobile host:** `apps/mobile/components/today/NorthStarBlockHost.tsx`,
  wired into `apps/mobile/app/(tabs)/index.tsx`; threads
  `dailyCalorieTarget` (`effectiveCalorieGoal`).

## Screen gate (ENG-935, 2026-06-17)

The block renders whenever the user is on **today, in day view** — full
stop. There is no longer a `remaining > 0` condition on the screen gate:

- **Mobile** `apps/mobile/app/(tabs)/index.tsx`:
  `showAboveMealsNorthStar = viewMode === "day" && isToday`
- **Web** `NutritionTracker.tsx`:
  `showAboveMealsNorthStarWeb = selectedDateKey === todayKey()`
  (the host's own `viewMode !== "day"` guard handles week view)

Before ENG-935 the gate also required `remaining > 0`, which made the
whole block vanish the moment the user was over-budget or dead-on
target — exactly the moments they still want to know what to eat (or be
told they're done). The over-budget / on-target state is owned by the
**host** (the calm `over-budget` caption below), not suppressed at the
screen. The host receives `remainingCalories = Math.max(0, remaining)`,
so the on-target day arrives as exactly `0` and resolves to the
`over-budget` branch — the user always sees the block, never a gap.

## Branch logic

The host (`NorthStarBlockHost`) picks the `kind` once the screen gate has
decided to render it:

| Condition                          | Render kind          |
|-----------------------------------|----------------------|
| `remainingCalories <= 0` (incl. on-target `=== 0`) | `over-budget` (calm caption) |
| `hasEverLoggedAnyMeal === false`  | `new-user` (calm first-meal card) |
| `library.size < NORTH_STAR_LIBRARY_MIN` (5; relaxed to 2 in the 30-day activation window) | `library-empty` (invitation row) |
| Picker returns null               | `no-fit` (browse caption)    |
| Picker returns a suggestion       | `default` (gradient card + CTA) |

## Time-of-day CTA branching

`detectSlotForHour(hour*60 + minute)` →

| Window           | Slot       | CTA                 |
|------------------|-----------|---------------------|
| 06:00–10:30      | breakfast | "Log breakfast"     |
| 10:30–14:30      | lunch     | "Log lunch"         |
| 14:30–17:30      | snack     | "Cook ahead →"      |
| 17:30–22:00      | dinner    | "Cook it →"         |
| 22:00–06:00      | (none)    | "Log it" (fallback) |

The slot is also threaded into the picker's filter — recipes whose
`mealType` excludes the slot are filtered out. Untagged recipes are
eligible for any slot.

## Scoring (rebuilt 2026-06-08 — ENG-995)

`pickNorthStarSuggestion(library, remaining, options?)` —

1. Reject when library empty, remaining calories ≤ 0, or all
   candidates excluded.
2. Filter by slot (if provided).
3. Compute a per-**meal** calorie budget (see below) — the recipe is
   scored against ONE meal's worth of calories, never the whole
   remaining day.
4. Per recipe, evaluate at its **actual single serving** — no portion
   scaling. `predictedCalories = recipe.calories` (and predicted
   macros are the recipe's per-serving macros), so the card shows the
   recipe's real per-serving number, identical to the recipe detail
   screen.
5. Score: asymmetric calorie penalty vs the per-meal budget (over ×3 /
   under ×1.5), protein-shortfall pull toward the **day's** remaining
   protein (×0.5), carb / fat distance from the day's remaining (×0.1).
6. Return the lowest-penalty recipe (always one serving) plus its
   adherence band, computed on the per-serving fit to the per-meal
   budget: `tight` (within 5%), `close` (within 15%), `loose` (beyond).

### Why this was rebuilt (founder feedback, ENG-995)

The original scorer (a) scaled each recipe by a `{0.5, 1.0, 1.5, 2.0}`
multiplier and surfaced the *scaled* number — so a 573-kcal/serving
recipe could display as 860 kcal (1.5×), which doesn't match the recipe
detail and isn't a real serving — and (b) scored every recipe against
the **entire remaining day**, so in the morning (a full day left) the
"best fit" was whatever recipe was closest to the whole day's worth of
calories, i.e. it preferred a giant double portion. Verbatim: *"use
actual servings when suggesting recipes, not scaled up ones … it's the
morning — you shouldn't suggest a double portion of one meal to fill the
whole day's calories, that makes no sense."*

Two fixes: **actual servings only** (no multiplier) and **score against
a per-meal budget**, not the whole remaining day. This is a correctness
fix, shipped without a feature flag.

### Per-meal calorie budget

```
perMealTarget = min(slotShare[slot] · dailyCalorieTarget, remaining.calories)
```

- `dailyCalorieTarget` is the user's **full** daily calorie target (not
  remaining). It's a required field on `NorthStarRemaining`, threaded
  from each Today host (`effectiveCalorieTarget` on web,
  `effectiveCalorieGoal` on mobile). Required-not-optional so the
  compiler forces every call site to supply it — no silent fall-back to
  whole-day scoring.
- `slotShare` is **tunable** via `NORTH_STAR_SLOT_SHARE` (exported):

  | Slot      | Share |
  |-----------|-------|
  | breakfast | 0.25  |
  | lunch     | 0.35  |
  | dinner    | 0.35  |
  | snack     | 0.10  |

  When no slot is detected (late night / pre-dawn — the generic "Log it"
  CTA case) the share is `NORTH_STAR_NO_SLOT_SHARE = 1.0`: the whole
  remaining day is the meal budget, because we genuinely don't know which
  meal this is and the `min(…, remaining)` cap never oversizes.
- The `min(…, remaining.calories)` cap means that late in the day, with
  little left, the meal budget shrinks to what's actually available — so
  the suggestion never exceeds the remaining day.

Result: a wide-open morning targets ~25–35% of the day (a normal single
meal); late in the day with little left it caps at `remaining`. It never
sizes one meal to the whole day. The shares are documented defaults — a
future flag / experiment can rebind `NORTH_STAR_SLOT_SHARE` without a
code change.

The scorer is independent from the planner's whole-day
`scoreMealSetCanonical`. The two scorers solve different problems
(single-recipe-against-a-meal-budget vs whole-day-set), and trying to
share one scorer was the failure mode that produced the gated
"Dinner could hit" prototype that this block replaces.

## Library threshold (V-6 sub-decision)

Default ships at `NORTH_STAR_LIBRARY_MIN = 5`. The constant is
re-exported into `src/lib/onboarding/v2/finalStep.ts` as
`ONBOARDING_PICK_MIN` so the onboarding "Pick 5 recipes" step + the
Today block can't drift out of sync.

If onboarding completion drops because 5 is too high a bar, drop to
3 via a flag override (per V-6) — both surfaces shift together.

## Swipe-to-skip (mobile only)

The mobile primitive uses raw `PanResponder` to detect a left-pan;
release at >50pt commits a `Skip` and triggers a decisive haptic
(`Haptics.ImpactFeedbackStyle.Medium`). The caller receives `onSkip`,
which the Today host wires to `pickNextNorthStarSuggestion(library,
remaining, new Set([prevId]))` to surface the next-best.

Reduce-motion fallback (per `useReduceMotion`): a small `X` button
appears top-right of the card and fires the same `onSkip`.

The PanResponder import is defensively guarded — the test-time RN
shim doesn't ship `PanResponder`, so the component falls back to a
no-op handler set in tests. The gesture path is exercised on-device
only.

## Web parity

Web has no swipe gesture — the spec says reduce-motion users see a
small `X` button at top-right at opacity 0.4 → 1 on hover. We
render the same `X` whenever an `onSkip` handler is supplied
(opacity transition is left to default Tailwind hover styles).

## State coverage (per spec Surface A §State)

- **Default** — gradient SupprCard with thumb / body / CTA + skip.
- **Loading** — host returns the gradient card with skeleton in
  body (TODO — current implementation gates on library + remaining;
  loading-while-library-fetches is a no-op render).
- **Empty (no fit)** — caption "Library has nothing under your
  remaining macros today" + Browse → text button.
- **Library < 5** — primary-tinted invitation: "Pick a few recipes
  you'd actually cook — we'll suggest from there." + button "Open
  Library →".
- **Over-budget** — calm caption: "You've hit your calories for
  today — eat freely, or save for tomorrow."

## Tests

- `tests/unit/northStarSuggestion.test.ts` — scorer pins (band
  thresholds, asymmetric penalty, slot filter, exclude-ids, CTA copy,
  library threshold, why-line). ENG-995 adds the three load-bearing
  pins: (a) a 573-kcal recipe suggestion shows 573 (one serving), not a
  scaled number; (b) a wide-open morning targets a meal-sized share of
  the day (slotShare · dayTarget), not the whole day, and picks the
  meal-sized recipe over a day-sized one; (c) the suggestion is never
  more than one serving (`portionMultiplier === 1`). Plus the
  `NORTH_STAR_SLOT_SHARE` / `NORTH_STAR_NO_SLOT_SHARE` constant pins.
- `tests/unit/northStarBlockPhase3.test.tsx` — web primitive (every
  kind, CTA, skip, thumbnail). Reads `predictedCalories` (now
  per-serving) — no edit needed.
- `apps/mobile/tests/unit/northStarBlockPhase3.test.tsx` — mobile
  primitive incl. reduce-motion `X` button fallback.
- `apps/mobile/tests/unit/northStarBlockHostPhase5.test.tsx` — mobile
  host branching; each render now supplies the required
  `dailyCalorieTarget` prop. ENG-935 adds the on-target boundary pin
  (`remainingCalories === 0` → `over-budget`, no suggestion chrome).
- `tests/unit/todayAboveMealsCap.test.ts` (web + mobile) — pins the
  ENG-935 permanent-block screen gate: the gate is day-view + today
  only and must NOT re-acquire a `remaining > 0` / `Math.max(0, …) > 0`
  suppression. `northStarBlockPhase3.test.tsx` (web + mobile) adds an
  ENG-935 over-budget render pin (caption replaces the suggestion —
  no header, no title, no CTA).

## Open visual-qa flags carried forward

- **V-1** — North-star gradient saturation on dark mode (visual-qa
  to A/B against a more muted variant).
- **V-3** — "Cook ahead →" copy for the 14:30–17:30 window
  (customer-lens to read 3 testers' reactions).
- **V-6** — Library-size threshold (5 vs 3 vs 1-with-apologetic
  copy). Default ships at 5; flag-driven adjustment supported.

## Coach engine — AI ranking layer (2026-06-11)

The deterministic single-pick scorer above is now the *spine* under an AI
coach layer, not the whole brain. Decision:
`docs/decisions/2026-06-11-meal-coach-and-digest-narrative.md`.

- **Engine:** `src/lib/nutrition/mealCoach.ts` (`assembleCandidates` →
  ranked candidate set; `parseCoachRanking` / `applyCoachRanking` fold the
  model's re-rank + phrasing back onto OUR numbers).
- **Route:** `POST /api/nutrition/coach` (Claude Haiku; deterministic
  fallback on every failure; `kill_meal_coach_ai` flag).
- **Hooks (non-blocking, parity):** `src/lib/today/useCoach.ts` (web) +
  `apps/mobile/lib/useCoach.ts` (mobile). Both render the deterministic
  candidates synchronously and swap in the AI ranking when it arrives — the
  surface never shows a spinner or an empty flash.
- **Contract:** the LLM only re-orders + phrases over the pre-scored
  candidates. It never invents food and never states a number that isn't
  ours. Validation drops invented ids and rejects health/diet-culture
  reason copy.

### Today wiring — DEFERRED (not silent)

The one-line swap of the suggestion brain inside
`apps/mobile/app/(tabs)/index.tsx#NorthStarBlockHost` (call `useCoach` and
pass the top candidate's `whyLine` into the existing block) is **not yet
landed**: the file is under active edit by the rhythm-sweep agent
(uncommitted hunks present; the gating `fix(rhythm): ENG-1032` commit had
not landed at build time). The engine, route, hooks, tests, and docs are
all complete and green — only the in-screen wiring remains.

**Next step (Linear-ready):** wire `useCoach` into `NorthStarBlockHost`
(web `src/app/components/NutritionTracker.tsx` + mobile
`apps/mobile/components/today/NorthStarBlockHost.tsx`) once index.tsx is
clean — replace the direct `pickNorthStarSuggestion` call with the hook's
top candidate, keeping the existing block surface unchanged. Title for the
ticket: "Wire coach engine into Today NorthStar surface (web + mobile)";
label `launch-blocker` is appropriate (Today = retention critical path).
The hook is a drop-in: it returns the same suggestion shape the block
already consumes.
