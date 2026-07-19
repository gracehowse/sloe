# What to Eat Next — the North-Star / Coach Loop

**One-line purpose:** the founder's named north-star moment — Suppr tells the
user what to eat next, ranked from their own saved recipes against the
macros they actually have left today — first as an always-on line on Today,
then (optionally) as a fuller `/coach` destination with a grounded day read
and bounded Q&A.

**Audience:** Product / Engineering / QA

**Status:** LIVE on both platforms. The Today block has been permanent since
2026-04-27 (no feature flag). The `/coach` destination screen is
default-**ON** behind `coach_screen_v1` (PostHog kill switch only).

---

## Scope

**In scope:**
- The Today `NorthStarBlockHost` — the always-on inline "what to eat next"
  block (this doc absorbs the former `north-star-2026-04-27.md`, renamed and
  evergreen — see [Rename note](#rename-note)).
- The full `/coach` destination screen: Today's read, What to eat next
  (ranked candidates), Ask the coach.
- The shared scorer (`northStarSuggestion.ts`) and the AI ranking layer
  (`mealCoach.ts`) that sits above it.
- Two known, currently open defects on mobile (a carbs/fat calculation drop
  and an unwired Log button) — documented here so they don't quietly read as
  intended behaviour.

**Out of scope:**
- The deterministic narrative/insight engine on Progress (digest, trajectory,
  adaptive-TDEE commentary) — covered by `docs/journeys/progress.md`
  (its "Design history" section absorbs the former
  `docs/journeys/progress-2026-04-27.md`, now a redirect stub).
- Recipe Detail and Cook Mode themselves — covered by
  `docs/journeys/discover-and-library.md` §4/§7; see [Loop](#loop) below.
- The staged Today coach-line copy contract itself (thresholds, exact
  strings) — owned by `coachOverBudgetStage.ts` and cross-linked from
  `docs/journeys/food-tracking.md`; this doc only establishes that it's part
  of the same loop and corrects one stale claim about its rollout state (see
  [Loop](#loop)).

---

## Why this exists

> "This is the single moment Suppr does what no competitor can. MacroFactor
> doesn't have your recipes. Mob/Paprika don't know your macros."

That's the founding rationale, set down when this block was designed in
April 2026 as a permanent fixture rather than a feature to A/B away.
"What to eat next" is the north-star moment — the question the product
answers better than any competitor because it's the only one with both the
user's own recipes and their actual macro budget in the same place.
Everything in this doc is that one moment, expressed at two depths: a single
always-on line on Today, and (behind a flag) a fuller destination screen
that adds a day narrative and bounded Q&A on top of the same ranking.

---

## Loop

```
Today (log meals + targets)
      │
      ▼
Today's North Star block            ← always renders in day view
      │  tap suggestion              │  tap "Coach" chip / deficit line (coach_screen_v1 ON)
      ▼                              ▼
Recipe Detail                  /coach destination screen
(log or cook — feeds                 ├─ Today's read (grounded narrative)
 back into Today totals)             ├─ What to eat next (ranked candidates, same scorer)
                                      └─ Ask the coach (3 bounded chips)
                                            │  tap a candidate row
                                            ▼
                                      Recipe Detail (same as above)
```

Forward links:
- **Tapping a suggestion → Recipe Detail.** Both the Today block and the
  `/coach` screen route to `/recipe/{id}` on tap. Recipe Detail itself is
  documented in `docs/journeys/discover-and-library.md` §4 — the trust
  surface (hero, macro strip, "fits your day" verdict, ingredient grid,
  servings stepper) a tapped suggestion lands on, and the jumping-off point
  for Cook Mode / logging back into Today.
- **The staged Today coach line** (`docs/journeys/food-tracking.md`, flag
  `coaching_stages_v1`) is a sibling surface on the same Today host — see
  [Staged Today coach line](#staged-today-coach-line) below for the
  correction this doc makes to a stale in-code claim about its flag state.
- **Shares its scorer** (`northStarSuggestion.ts`) with the Plan tab's
  suggestion surfaces — a change to that scorer ripples across Today, Plan,
  and Coach. See `docs/journeys/meal-planning.md`.

---

# Part 1 — Today North-Star block

This block has shipped as a permanent, unflagged part of Today since April
2026. It's specified in `docs/specs/2026-04-27-production-design-spec.md`
§A-northstar.

## What it is

A permanent block on Today, second thing the eye lands on after the calorie
ring, that suggests one recipe from the user's library that fits the
calories + macros they have left for the slot they're in.

## Component map

- **Scorer (shared lib):** `src/lib/nutrition/northStarSuggestion.ts`
  — `pickNorthStarSuggestion`, `pickNextNorthStarSuggestion`,
  `detectSlotForHour`, `ctaForSlot`, `bandLabel`,
  `NORTH_STAR_LIBRARY_MIN`, `isLibraryEligibleForNorthStar`,
  `NORTH_STAR_SLOT_SHARE`, `NORTH_STAR_NO_SLOT_SHARE`.
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

## Screen gate

The block renders whenever the user is on **today, in day view** — full
stop. There is no longer a `remaining > 0` condition on the screen gate:

- **Mobile** `apps/mobile/app/(tabs)/index.tsx`:
  `showAboveMealsNorthStar = viewMode === "day" && isToday`
- **Web** `NutritionTracker.tsx`:
  `showAboveMealsNorthStarWeb = selectedDateKey === todayKey()`
  (the host's own `viewMode !== "day"` guard handles week view)

Before this change, the gate also required `remaining > 0`, which made the
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

## Scoring (rebuilt 2026-06-08)

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

### Why this was rebuilt (founder feedback)

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

## Library threshold

Default ships at `NORTH_STAR_LIBRARY_MIN = 5`. This threshold used to be
enforced twice — once here, and once by a user-facing "Pick 5 recipes"
onboarding step (`src/lib/onboarding/v2/finalStep.ts`, which re-exported the
constant as `ONBOARDING_PICK_MIN`) — so the picker and the Today block
couldn't drift out of sync. That onboarding step and its file have since
been removed as dormant code; there's no picker to keep in sync with any
more.

The threshold still exists and still matters, but it's now cleared
automatically: `selectOnboardingSeeds`
(`src/lib/onboarding/onboardingSeeds.ts`, shared by web + mobile) seeds
every new library from a diet/allergen-filtered curated set sized to clear
`NORTH_STAR_LIBRARY_MIN` on completion, so the block basically never
renders `library-empty` for a user who finished onboarding. See
`docs/journeys/onboarding-to-first-log.md` (Completion section) for the
seeding flow. `library-empty` is now reached almost exclusively by an
existing, low-activity library — which is what the already-shipped 30-day
activation window (`NORTH_STAR_LIBRARY_MIN_ACTIVATION = 2`, see the branch
logic table above) softens. A steady-state threshold below 5 was
considered and never shipped; whether the steady-state number itself
should move remains an open design question (see below).

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

## Web parity (Today block)

Web has no swipe gesture — the spec says reduce-motion users see a
small `X` button at top-right at opacity 0.4 → 1 on hover. We
render the same `X` whenever an `onSkip` handler is supplied
(opacity transition is left to default Tailwind hover styles).

## State coverage

- **Default** — gradient SupprCard with thumb / body / CTA + skip.
- **Loading** — host returns the gradient card with skeleton in
  body (current implementation gates on library + remaining;
  loading-while-library-fetches is a no-op render).
- **Empty (no fit)** — caption "Library has nothing under your
  remaining macros today" + Browse → text button.
- **Library < 5** — primary-tinted invitation: "Pick a few recipes
  you'd actually cook — we'll suggest from there." + button "Open
  Library →".
- **Over-budget** — calm caption: "You've hit your calories for
  today — eat freely, or save for tomorrow."

## Tests (Today block)

- `tests/unit/northStarSuggestion.test.ts` — scorer pins (band
  thresholds, asymmetric penalty, slot filter, exclude-ids, CTA copy,
  library threshold, why-line). Includes three load-bearing pins added
  when the scorer was rebuilt: (a) a 573-kcal recipe suggestion shows 573
  (one serving), not a scaled number; (b) a wide-open morning targets a
  meal-sized share of the day (slotShare · dayTarget), not the whole day,
  and picks the meal-sized recipe over a day-sized one; (c) the suggestion
  is never more than one serving (`portionMultiplier === 1`). Plus the
  `NORTH_STAR_SLOT_SHARE` / `NORTH_STAR_NO_SLOT_SHARE` constant pins.
- `tests/unit/northStarBlockPhase3.test.tsx` — web primitive (every
  kind, CTA, skip, thumbnail). Reads `predictedCalories` (now
  per-serving) — no edit needed.
- `apps/mobile/tests/unit/northStarBlockPhase3.test.tsx` — mobile
  primitive incl. reduce-motion `X` button fallback.
- `apps/mobile/tests/unit/northStarBlockHostPhase5.test.tsx` — mobile
  host branching; each render supplies the required `dailyCalorieTarget`
  prop, including the on-target boundary pin (`remainingCalories === 0` →
  `over-budget`, no suggestion chrome).
- `tests/unit/todayAboveMealsCap.test.ts` (web + mobile) — pins the
  permanent-block screen gate: the gate is day-view + today only and must
  not re-acquire a `remaining > 0` / `Math.max(0, …) > 0` suppression.
  `northStarBlockPhase3.test.tsx` (web + mobile) adds an over-budget
  render pin (caption replaces the suggestion — no header, no title, no
  CTA).

## Open design questions (Today block)

Three details remain under discussion: whether the north-star gradient's
saturation reads too strong in dark mode and would land better muted;
whether "Cook ahead →" is the right label for the 14:30–17:30 window, given
it stretches the "ahead" framing across both an afternoon snack and dinner
prep; and whether the library-size threshold belongs at 5, or should be
lower — 3, or even 1 with softer copy for a barely-started library.

## Coach engine — AI ranking layer (2026-06-11)

The deterministic single-pick scorer above is now the *spine* under an AI
coach layer, not the whole brain.

- **Engine:** `src/lib/nutrition/mealCoach.ts` (`assembleCandidates` →
  ranked candidate set, up to 4; `parseCoachRanking` / `applyCoachRanking`
  fold the model's re-rank + phrasing back onto OUR numbers).
- **Route:** `POST /api/nutrition/coach` (Claude Haiku; deterministic
  fallback on every failure; `kill_meal_coach_ai` flag).
- **Hooks (non-blocking, parity):** `src/lib/today/useCoach.ts` (web) +
  `apps/mobile/lib/useCoach.ts` (mobile). Both render the deterministic
  candidates synchronously and swap in the AI ranking when it arrives (10s
  `COACH_REFINE_TIMEOUT_MS` AbortController ceiling on both platforms) —
  the surface never shows a spinner or an empty flash.
- **Contract:** the LLM only re-orders + phrases over the pre-scored
  candidates. It never invents food and never states a number that isn't
  ours. Validation drops invented ids and rejects health/diet-culture
  reason copy.

This engine feeds both the Today block's `whyLine` (wiring not yet landed —
see below) and the full `/coach` screen's "What to eat next" section
(shipped — see [Part 2](#part-2--the-full-coach-destination-screen)).

### Today block wiring status

The Today block still calls `pickNorthStarSuggestion` directly, not through
`useCoach` — the one-line swap that would let it call the AI-ranked engine
and surface a `whyLine` (in
`apps/mobile/app/(tabs)/index.tsx#NorthStarBlockHost`, wiring `useCoach` and
passing the top candidate's `whyLine` into the existing block) has not
landed. The engine, route, hooks, tests, and the `/coach` destination screen
are all shipped; only this last piece of wiring is outstanding.

---

# Part 2 — The full Coach destination screen

**Status:** live on both platforms. `coach_screen_v1` has been default-ON
since 2026-07-07 (grouped inside `REDESIGN_DEFAULT_ON` in
`src/lib/analytics/track.ts` and its mobile mirror), so the screen ships to
every user subject only to a PostHog kill switch.

## What it is

A standalone push/route screen — **not a chat**. No free-text input, no open
conversation. It stacks three grounded, read-only sections built entirely
from the user's own computed numbers:

1. **Today's read** — a short narrative of the day so far.
2. **What to eat next** — the same shared scorer as the Today block, ranked
   and (Pro-only) AI-rephrased.
3. **Ask the coach** — 3 fixed chips, never free text.

Every number shown is the app's own computed figure. The LLM (Claude Haiku)
is only ever allowed to re-order and phrase over facts the app already
computed — a numbers-grounding validator strips anything it invents.

### Why a destination screen, not just a bigger Today block

The call was to ship the prototype's unified Coach destination as a
flag-gated push screen — a straightforward "build what was designed"
decision. It doesn't fully resolve the deeper question underneath it: why
build an AI-voiced coach at all, given the product's stated "no AI chat"
trust posture elsewhere. Whether this bounded, grounded coach voice is the
intended long-term direction, or a beta-window experiment, is still an open
product question — see [Open product questions](#known-limitations-and-open-questions).

## Entry points

Both platforms share the same `coach_screen_v1` gate on all entries; when the
flag is OFF, `/coach` redirects to Today and no entry point renders.

- **Coach chip in the Today hero chip row** — mobile `TodayHeroRing`
  (`onPressCoach`) / web `today-hero-ring.tsx` `HeroCoachChip`.
- **Tapping the Today deficit coach line** deep-links to `/coach` — mobile
  `TodayScreen.tsx`; web `NutritionTracker.tsx`.
- **Web-only: a desktop sidebar "Coach" item** (`desktop-sidebar.tsx`,
  `CoachSidebarItem`) — added because the mobile-web hero chip renders
  `md:hidden` and desktop has no hero-row equivalent.

## Today's read (grounded day narrative)

A 2–3 sentence present-tense reflection on the user's day so far (calories /
protein logged vs target, meals logged, next open slot).

- Renders a deterministic template **instantly**, then swaps in an
  AI-phrased version via `POST /api/nutrition/coach-day-narrative` if the
  user is Pro and the model returns on-contract text.
- The model may only phrase over supplied facts; `parseCoachDayNarrative`
  rejects any multi-digit number not in the facts, plus a banned-phrase list
  ("healthy", "you should", diet-culture language, etc.).
- Template fallback guarantees a non-empty, grounded surface even with AI
  off / over-budget / off-contract.
- **Pro-gating the AI voice** follows the same posture used elsewhere for
  AI features — voice logging, for instance, is Pro-only and enforced
  server-side, not just client-side, so a free user can't spoof Pro status
  to unlock the AI phrasing.
- Shared pure module: `src/lib/nutrition/coachDayNarrative.ts` (web) mirrored
  at `src/lib/nutrition-core/coachDayNarrative.ts` (mobile) — identical
  request shape, identical fallback. Both build facts from **calories +
  protein only**, so this section is unaffected by the mobile carbs/fat bug
  below.

The endpoint contract is documented in `docs/api/endpoints.md`.

## What to eat next (ranked coach candidates)

Ranks the user's OWN saved recipes against the macros they have left and
shows up to 4, each with a one-line "why", a Best-fit badge on #1, and a
"~{kcal} · {protein}g" line.

- **Spine:** `assembleCandidates` → the same `northStarSuggestion` scorer
  used by the Today block, run client-side, rendered instantly.
- **AI layer:** `POST /api/nutrition/coach` optionally lets the model
  (Pro-only, 2+ candidates) re-order and re-phrase, folded back onto local
  candidates **by id** so numbers never drift.
- **Validation:** `parseCoachRanking` drops invented ids, collapses dupes,
  and rejects health/diet-culture reason copy.
- **Never-empty fallback:** the deterministic candidate list always renders;
  the AI pass can only re-order it, never replace it with something ungrounded.

This is the most carefully built part of the area — the candidate pre-filter
is the whole safety story: the model never touches the raw library or raw
numbers, only the pre-scored candidate set.

**Next step:** tapping a row routes to `/recipe/{id}` on both platforms
(`onCandidatePress`). See [Loop](#loop) for the forward link.

### Mobile-only defect: logged carbs and fat are dropped from the ranking input

`apps/mobile/app/coach.tsx` maps each logged entry into `TodayMeal` with only
`name`, `calories`, `protein`:

```ts
type TodayMeal = {
  name?: string | null;
  calories?: number | null;
  protein?: number | null;
};
// ...
setMealsToday(
  (entries ?? []).map((e) => ({
    name: e.name,
    calories: e.calories,
    protein: e.protein,
  })),
);
```

`totals` then reads `carbs`/`fat` off that same object via an `as` cast:

```ts
carbs += Number((m as { carbs?: number }).carbs) || 0;
fat += Number((m as { fat?: number }).fat) || 0;
```

Since `carbs`/`fat` were never copied onto `TodayMeal`, this always reads
`undefined` → `Number(undefined) || 0` → `0`. So on mobile,
`totals.carbs`/`totals.fat` are **always 0**, and
`remaining.carbs`/`remaining.fat` are **always the user's full daily
target**, regardless of what they actually logged.

Web's `coach-screen-client.tsx` maps the full row (`m.carbs`, `m.fat`) from
`nutritionByDay` and computes `totals`/`remaining` correctly.

**Consequence:** the scorer's carb/fat distance term (weight ×0.1 — the
smallest term in the [scoring formula](#scoring-rebuilt-2026-06-08) above)
is computed against a wrong budget on mobile only. Calories and protein (the
dominant terms) are correct on both platforms, so rank flips will be
uncommon but not impossible — and when they happen, mobile and web can show
a **different #1 suggestion for the same user in the same state**, which is
exactly the kind of silent parity break the "canonical Today" strategic
direction rules out.

**Status:** open and unfixed. The fix is a one-file change — extend
`TodayMeal` to include `carbs` and `fat`, map them in the `.map()`, and drop
the `as` cast — plus a regression test pinning `remaining.carbs`/
`remaining.fat` against a fixture with non-zero logged carbs/fat.

### Other mobile/web divergences (documented, lower severity)

- **Data source:** mobile re-fetches profile + entries from Supabase on every
  `/coach` open (`coach.tsx` lines ~99–138); web reads the cached
  `AppDataContext`. Mobile pays two extra round-trips per open. Not
  incorrect, just slower.
- **AI timeout / refining-stuck protection** is shared — both platforms use
  the same 10s `COACH_REFINE_TIMEOUT_MS` ceiling.

## Ask the coach (bounded chips)

Three fixed chips — never free text:

- "What's a high-protein snack?"
- "I'm eating out tonight"
- "Plan tomorrow for me"

Each maps to a bounded grounded prompt over the user's day facts + top
candidate. Tapping fires `POST /api/nutrition/coach-ask`:

- **Pro users** get an AI-phrased 2–4 sentence answer.
- **Free users** get a deterministic template answer — same 200 response
  shape, `source: "template"`, **never a 403**.
- `numbersAreGrounded` rejects any answer containing a number not in the
  facts; a banned-phrase list blocks health/weight-loss claims
  ("lose weight", "detox", "you must", etc.).
- A permanent disclaimer sits below every answer: *"Sloe is a tracking tool,
  not a medical or dietary advisor."*

Every path (AI ok / AI off-contract / budget exceeded / provider error /
non-Pro) resolves to a grounded response — the surface can degrade in
*quality* but never in *honesty* or *availability*.

Shared module: `src/lib/nutrition/coachAsk.ts` (web) /
`src/lib/nutrition-core/coachAsk.ts` (mobile) — identical chip set, prompts,
and validators.

### Dead scaffolding: the one-tap "Log" button doesn't work on mobile and doesn't exist on web

`apps/mobile/components/coach/CoachScreenView.tsx` accepts an
`onCandidateLog?: (recipeId: string) => Promise<void> | void` prop
(described in a code comment as a compact secondary "Log" action that
one-tap logs the candidate to the suggested slot via the host's existing
quick-log insert helper) and renders a `QuickLogButton` on each candidate
row when the prop is supplied.

**`apps/mobile/app/coach.tsx` never passes `onCandidateLog`** to
`CoachScreenView` — the prop is always `undefined`, so the button never
renders on mobile in practice. Web's `CoachScreen` (`coach-screen.tsx`) has
no `onCandidateLog` prop or `QuickLogButton` at all — the affordance doesn't
exist there in any form.

To be clear: the "Log" button is not a shipped feature that's merely
mobile-only — it is unwired dead code on the one platform that has it, and
absent everywhere else. Do not describe it as "mobile has one-tap log" in
any customer-facing or product-status context. Two honest paths forward:
(1) wire it (mobile: pass `onCandidateLog` from `coach.tsx` using the
existing quick-log insert helper; then build the same affordance on web), or
(2) if it was deliberately dropped, delete the mobile prop + `QuickLogButton`
import rather than leave live-looking scaffolding in a production file.
Either path requires a code change — documentation alone won't fix it.

## Tests (Coach screen)

Endpoint-level tests and shared-module tests are documented alongside
`docs/api/endpoints.md` §480–587 (deterministic spine, AI fold-back, kill
switches, client hooks). No dedicated end-to-end journey test suite
(Maestro/Playwright) covers `/coach` yet — see
[Known limitations and open questions](#known-limitations-and-open-questions)
for the coverage gap.

## Analytics

- `coach_screen_opened` (`platform`)
- `meal_coach_suggestion_shown` (`source`, `candidateCount`, `slot`,
  `platform`) — fires once per screen-view, waits for AI refine to settle
  on 2+ candidate sets so it doesn't undercount AI hit-rate.
- `coach_ask_chip_tapped` (`chip_id`, `platform`)
- `coach_ask_answered` (`chip_id`, `source`, `platform`) — completion pair
  for the chip tap, fires on every resolution path including the
  client-side template fallback.

---

## Staged Today coach line

This is the sibling surface to everything above. The "coach line" that
renders inline on the Today `NorthStarBlockHost` (distinct from the
`/coach` destination above) selects calm, state-aware copy by % of calorie
goal — approaching (85–100%), landed (100–110%), over (110–140%), big
(140%+), plus two ED-safe under-eating nudges. It replaces the old
state-blind line that "reads as parody at +1,450 kcal." Full detail lives in
`docs/journeys/food-tracking.md` and the module itself:
`src/lib/nutrition/coachOverBudgetStage.ts` (mirrored at
`src/lib/nutrition-core/coachOverBudgetStage.ts`).

**Flag state note:** `coachOverBudgetStage.ts`'s module header comment
currently describes `coaching_stages_v1` as default-OFF pending validation
in sim/web. That's out of date: `coaching_stages_v1` was moved into
`REDESIGN_DEFAULT_ON` on 2026-07-07 (`src/lib/analytics/track.ts` line 197,
grouped alongside a comment describing it as the staged coach copy +
broken-streak recap flag) — it's **default-ON on both platforms** today,
subject only to a PostHog kill switch, same as `coach_screen_v1`. The
comment should be updated so it no longer contradicts the shipped flag
state. There's only one comment to fix: `src/lib/nutrition-core/coachOverBudgetStage.ts`
(the mobile "mirror") is a pure two-line re-export
(`export * from "../nutrition/coachOverBudgetStage";`) with no header of its
own, so fixing the single shared comment in
`src/lib/nutrition/coachOverBudgetStage.ts` covers both platforms.

When `coach_screen_v1` is also on, the Today coach line and hero chip both
deep-link through to the full `/coach` screen — the two surfaces are one
loop, not two independent features.

---

## Known limitations and open questions

`docs/ux/redesign/ai-coach.md` still describes the product's AI posture as
"no AI chat, no Ask tab, no LLM-backed coach in Suppr" and explicitly
instructs against building a bounded Ask surface without an explicit
product greenlight. The Coach screen has since shipped exactly that — an
LLM-voiced day narrative plus LLM-answered bounded Ask chips, default-on for
every user. That older spec document is now out of date on this point and
needs a superseded note of its own; this journey doc is not that update.

The unwired mobile "Log" button (see above) raises a real product question:
was one-tap logging from the Coach screen intentionally dropped, or did the
affordance get lost along the way? Until that's settled, the scaffolding
sits in the mobile app unused, and the fastest good-faith options are either
finishing the wiring on both platforms or removing the dead code so it stops
looking shipped.

Whether an LLM-voiced coach — even one this bounded and numbers-grounded —
is the product's intended long-term direction, or a beta-window experiment,
is still unresolved. The decision to ship this screen settled the shipping
mechanics, not that deeper question.

There is no dedicated end-to-end journey test (Maestro on mobile, Playwright
on web) for `/coach` — coverage stops at the unit and route level. That's a
moderate-severity gap given the screen is default-on for every user.

---

## Rename note

This file replaces the former `docs/journeys/north-star-2026-04-27.md`. The
rename drops the date suffix because this is the founder's permanent, named
north-star loop rather than a dated snapshot, and because the doc now also
covers the `/coach` destination screen, which didn't exist when the original
file was written. All of the original file's content is preserved here, in
Part 1, unchanged.

`docs/journeys/north-star-2026-04-27.md` itself is now a redirect stub
pointing here rather than deleted outright; it should be removed (`git rm`)
once any remaining consumers have moved off it.

---

## Related docs

- `docs/journeys/food-tracking.md` — the Today host this whole loop is a
  branch off; also owns the staged coach-line copy contract.
- `docs/journeys/discover-and-library.md` §4 — Recipe Detail, the surface a
  tapped "what to eat next" suggestion lands on.
- `docs/journeys/meal-planning.md` — shares the `northStarSuggestion` scorer
  spine with the Plan tab's suggestion surfaces.
- `docs/journeys/onboarding-to-first-log.md` (Completion section) — how a
  brand-new library gets seeded past `NORTH_STAR_LIBRARY_MIN` automatically,
  now that the onboarding recipe-picker is gone (see "Library threshold"
  above).
- `docs/api/endpoints.md` — request/response contracts for
  `/api/nutrition/coach`, `/coach-day-narrative`, `/coach-ask`.
- `docs/decisions/2026-06-11-meal-coach-and-digest-narrative.md` — the AI
  ranking layer's grounding contract and rationale.
- `docs/ux/redesign/ai-coach.md` — describes an older "no AI chat" posture
  that the Coach screen now contradicts; it needs its own superseded note
  (see [Known limitations and open questions](#known-limitations-and-open-questions)
  above).
