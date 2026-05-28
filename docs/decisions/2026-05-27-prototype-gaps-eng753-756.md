# Prototype gap closure — status pills, mobile weekly insight, mobile progress tiles, discover parity

**Date:** 2026-05-27
**Area:** Today + Progress + Discover (web + mobile)
**Status:** Resolved (shipped behind PostHog flags; default off)
**Linear:** ENG-753, ENG-754, ENG-755, ENG-756 (+ ENG-758 follow-up)

## Context

Four prototype-vs-live gaps were closed in a single change, each ramped
behind its own PostHog feature flag (per the CLAUDE.md visual-change
flag rule). Flags are absent in PostHog at ship time → they default to
`false`, so every new render path is dark until deliberately ramped.

## What shipped

### ENG-753 — Today hero status pills (web + mobile)
Two badge pills below the Today hero stats (prototype
`screens-web.jsx:173-177`):
- **"On track"** — success-green; shown when the user has logged today
  (>100 kcal) AND total calories are within ±10% of the daily target.
- **"Adaptive TDEE learning · N of 7 days"** — primary-tinted; shown
  when `N > 0`.

`N` (`tdeeLearnDays`) is currently a **proxy** derived from the adaptive
TDEE confidence bucket (high → 6, medium → 4, low → 2, none → 0). This
stands in for a real weigh-in count until `weight_logs` is queried into
the Today data layer — tracked as **ENG-758**. The proxy is honest in
shape (more confidence ≈ more weigh-ins) and never fabricates nutrition.

- Web: `src/app/components/suppr/today-hero-stats.tsx` (desktop hero),
  wired in `src/app/components/NutritionTracker.tsx`.
- Mobile: `apps/mobile/components/today/TodayHero.tsx` (below the ring),
  wired in `apps/mobile/app/(tabs)/index.tsx`.
- Flag: `today-status-pills`.

### ENG-754 — Mobile Today weekly insight card
React Native port of web's `today-weekly-insight-card.tsx`. Renders
below the meals list on Today (day view): household planning line,
logged-days count, daily kcal average, and a 7-bar sparkline. Sparkline
maths is shared in shape with web (`safeMax = max(target × 1.2,
...daily, 1)`; empty days clamp to a 4% baseline; `weekAvgKcal = null`
→ no faux "0 kcal" average).

`householdSize` is passed as `1` (the user themselves) — the honest
minimum, because the Today data layer does not currently load household
membership. Wiring a real count is also **ENG-758**.

- Mobile: `apps/mobile/components/today/WeeklyInsightCard.tsx`, wired in
  `apps/mobile/app/(tabs)/index.tsx`.
- Flag: `today-weekly-insight-mobile`.

### ENG-755 — Mobile Progress trend summary tiles
React Native port of web's `TrendSummaryCardWeb` (inside
`ProgressDashboard.tsx`). Renders **above** `DigestStoryCard` on the
Progress tab. Rows: days hit calorie target (±10%), days hit protein
target, weigh-ins, and an optional "Projected <goal> by <date>" row
(shown only when a goal weight + finite days-to-goal exist).

- Mobile: `apps/mobile/components/progress/TrendSummaryCard.tsx`, wired
  in `apps/mobile/app/(tabs)/progress.tsx`.
- Flag: `progress-trend-summary-mobile`.

### ENG-756 — Discover fit-% badge parity audit
**No action needed.** Audit found that neither web (`DiscoverFeed.tsx`)
nor mobile (`discover.tsx`) renders a fit-% badge — both removed it via
F-45 (2026-04-22) after tester feedback ("Score means nothing —
remove"), keeping only the `computeRecipeFitPercent` helper imported for
a future ranking pass. Parity is intact. Stale comments that still
described the (long-removed) pill were cleaned up to reflect F-45
reality. Removal stays pinned on both surfaces by
`tests/unit/recipeCardFitBadge.test.ts`.

## Flags

| Flag | Surface | Default |
|---|---|---|
| `today-status-pills` | Today hero (web + mobile) | off (absent) |
| `today-weekly-insight-mobile` | Today below-meals (mobile) | off (absent) |
| `progress-trend-summary-mobile` | Progress above digest (mobile) | off (absent) |

All read via `isFeatureEnabled(...)` — web `src/lib/analytics/track.ts`,
mobile `apps/mobile/lib/analytics.ts`. Absent flag = `false`, so the old
path (no pills / no card) stays live until ramped via the PostHog
dashboard.

## Tests

- `tests/unit/todayStatusPills.test.tsx` (web) — flag gate + per-pill
  visibility + empty-day suppression.
- `apps/mobile/tests/unit/todayStatusPills.test.tsx` — mobile mirror.
- `apps/mobile/tests/unit/weeklyInsightCardMobile.test.tsx` — sparkline
  maths parity + empty-state + flag gate.
- `apps/mobile/tests/unit/trendSummaryCardMobile.test.tsx` — row set +
  projected-goal conditional + flag gate.
- `tests/unit/recipeCardFitBadge.test.ts` (existing) — ENG-756 no-render
  pin, both platforms.

## Follow-up

- **ENG-758** — replace the `tdeeLearnDays` confidence-bucket proxy with
  a real weigh-in count, and feed a real household size into the mobile
  weekly insight card, once the Today data layer exposes them.
