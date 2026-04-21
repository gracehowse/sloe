# Plan tab — prototype-port fixes (day label, meal-row icon-box, summary card ordering)

**Status:** Resolved (shipped 2026-04-20)
**Area:** UI / parity
**Owner:** product-engineer

## Context

The 2026-04-19 whole-app-experience prototype port
(see `2026-04-20-web-parity-for-mobile-prototype-port.md`) landed the
"This week" summary card, round-pill header, and empty-slot rendering
on the Plan tab. Grace's follow-up screenshot (2026-04-20) showed three
gaps vs prototype:

1. The "This week" summary card was positioned below `<HouseholdCard />`
   on mobile. When Grace's screen was captured at the top of the
   scrollview, the summary was off-screen and she assumed it hadn't
   rendered. The prototype ordering puts the at-a-glance copy first and
   the household surface second.
2. Day section headers read "Day 1" / "Day 2". The prototype shows the
   3-letter weekday ("Mon" / "Tue" / "Wed") with a small uppercase
   "TODAY" pill on the current-day row
   (`screens-mobile.jsx:482`).
3. Meal rows were just label + title + "Log today" on mobile and a
   cluster of text buttons on web. The prototype rows have a 36×36
   slot-appropriate icon-box on the left (`sun` / `utensils` / `moon` /
   `cookie`-like) and a small 30×30 square swap button on the right.

## Scope

### 1. Summary card position (mobile only)

`apps/mobile/app/(tabs)/planner.tsx`: moved `<HouseholdCard />` to
render AFTER the "This week" summary card. Gate on the summary card is
unchanged (`plan && plan.length > 0 && planTargets && summaryScore`) —
the earlier perceived missing-card was a scroll-ordering issue, not a
gate bug. Web has no `HouseholdCard` embedded in `MealPlanner`, so no
move needed there.

### 2. Day section header (`"Mon"` / `"TODAY"` pill)

Both files now compute the calendar date off `(dayIdx, startOffset)`
and render a shared `shortWeekdayLabel(date)` + `isSameCalendarDay(date)`
helper:

- **Mobile** (`planner.tsx`): `<Text style={styles.dayTitle}>{weekdayLabel}</Text>`
  + inline uppercase "TODAY" pill in `Accent.primary` next to the
  weekday when the day row maps to today.
- **Web** (`MealPlanner.tsx`): same logic inside the existing
  `<h3>` day card header, plus the horizontal jump-strip entries now
  also read `"Mon"` / `"Tue"` (they were still reading `"Day N"`).

Web uses `dayIdx` directly because no `startOffset` is exposed to web
yet. When that lands (it's mobile-only right now), the 0 second arg
flips to the real offset.

### 3. Meal-row icon-box + swap button

Both files now render:
- **Left**: 36×36 muted square with a slot-appropriate icon
  (`breakfast → Sun/sunny-outline`, `lunch → Utensils/restaurant-outline`,
  `dinner → Moon/moon-outline`, `snacks → Cookie/ice-cream-outline`).
- **Middle**: slot overline (11pt uppercase muted) + recipe title +
  existing badges / metadata.
- **Right**: 30×30 square icon button (`RefreshCw` / `refresh-outline`)
  that fires the existing `swapMeal(...)` flow. `onClick` / `onPress`
  calls `stopPropagation` so the row-level action sheet / drag handler
  doesn't also fire.
- **Right (continued)**: "Log today" (mobile) / "Log" (web) stays in
  place next to the swap button. The prototype omits this but it's a
  Suppr-specific affordance we're keeping per the fix spec.

Web retains its portion-stepper, Move, Cook, and Recipe buttons in the
same right-side cluster. They weren't in the prototype but they're
existing Suppr functionality outside the three-fix scope; the spec
called out "don't touch … swap sheet logic" and nothing about those
adjacent actions, so they stay.

## Shared helpers

Added `src/lib/planning/planDayLabel.ts` — framework-agnostic module
exposing:

- `shortWeekdayLabel(date)` — 3-letter `en-US` weekday, always English
  (the Plan tab is not localised yet).
- `planCalendarDateForIndex(idx, startOffset = 0)` — calendar date at
  plan row `idx`, offset from today by `startOffset` days.
- `isSameCalendarDay(date, reference = now)` — midnight-normalised day
  equality for the "TODAY" pill gate.
- `resolvePlanSlotIconKey(rawSlot)` — maps `meal.name` (or raw voice
  input) to a canonical icon key (`"breakfast"` / `"lunch"` / `"dinner"`
  / `"snacks"`). Unknown / empty slots fall through to `"snacks"` so
  the UI never renders a blank square.
- `PlanSlotIconKey` type — each platform maps the key to its own icon
  library: web → `lucide-react`, mobile → `@expo/vector-icons`
  Ionicons.

## Tests

- New: `tests/unit/planDayLabel.test.ts` (10 tests) pinning:
  - `resolvePlanSlotIconKey` canonical slot mapping, case /
    whitespace / `"Snack"` legacy normalisation, and
    unknown-falls-through-to-snacks behaviour.
  - `shortWeekdayLabel` returns the expected 3-letter day for each
    day of week (deterministic fixture dates).
  - `planCalendarDateForIndex` / `isSameCalendarDay` with fake timers
    so CI (UTC, off-midnight) doesn't flake the "today" check.
- Web vitest: `177 files, 2132 tests` — all pass.
- Mobile vitest: `54 files, 439 tests` — all pass (with `--testTimeout=30000`;
  the existing `mealPlanAlgo.test.ts` is pre-existing slow at ~3s per
  case, unchanged by this batch).
- Web typecheck: clean.
- Mobile typecheck: clean.
- `next build`: clean after `.next` cache clear (required because local
  Next.js 15 cache had a stale pages-manifest from prior builds).

## Parity

| Surface | Web | Mobile | Intentional diff |
| --- | --- | --- | --- |
| Summary card order | above everything else (no household embed) | above `<HouseholdCard />` | Web has no household embed inside MealPlanner; when it lands, same "above household" rule. |
| Day section header | `Mon` + "TODAY" pill | `Mon` + "TODAY" pill | — |
| Jump strip day label | `Mon` / `Tue` / … | `Mon` / `Tue` / … | — |
| Meal-row icon-box | 36×36 lucide `Sun`/`Utensils`/`Moon`/`Cookie` | 36×36 Ionicons `sunny-outline`/`restaurant-outline`/`moon-outline`/`ice-cream-outline` | Icon library; visual weight identical. |
| Swap control | 30×30 icon button (`RefreshCw`) | 30×30 icon button (`refresh-outline`) | — |
| Log today | web button ("Log") | mobile button ("Log today") | Copy slightly shorter on web (space constraint); both stay next to swap. |
| Portion stepper / Move / Cook / Recipe (web) | Present | N/A | Web-only surfaces — mobile handles via the row's long-press action sheet. |

## Non-goals / follow-ups

- Mobile-side: still consumes its inline `summaryScore` memo rather
  than `computePlanWeekSummaryScore`. The copy-producing logic is
  identical; a pure-cleanup refactor is open and low-risk.
- Snacks icon: prototype notes say "cookie or similar" — mobile uses
  `ice-cream-outline` because Ionicons lacks a direct cookie glyph.
  Close-enough substitution; swap for `nutrition-outline` if the brand
  team prefers a savoury feel later.
- Web's startOffset is not yet exposed — web always computes day
  labels off `dayIdx + 0`. When "start tomorrow" / "start next week"
  ships on web, the 0 in `planCalendarDateForIndex(dayIdx, 0)` flips
  to the wired state.
