# Progress tab — Apple Health range grammar (ENG-1030)

- **Date:** 2026-06-10
- **Area:** Progress tab (web + mobile)
- **Status:** Resolved
- **Linear:** ENG-1030
- **Authors:** product-lead direction (Grace) → implementation

## Decision

The Progress tab's time-range picker moves off the Claude Design prototype's
relative-window pills (`7d / 30d / 90d / All`) onto **Apple Health's
calendar-anchored range grammar**:

- **Five segments:** D / W / M / 6M / Y, rendered as a §8 segmented control
  (rail on the `inputBg` token; the active segment elevates onto a `card` pill
  with the aubergine `primarySolid` label). Default = **W** (current week),
  matching Apple Health.
- **Period paging:** a `‹ label ›` row under the segments. Chevrons page
  prev/next between whole periods; the label reads the period
  (`"8–14 Jun"` / `"June 2026"` / `"Jan – Jun 2026"` / `"2026"`). The forward
  chevron is **disabled and dimmed on the current period** — paging never
  enters the future.
- **"All" is removed.** Apple Health has no "All"; Y + paging covers history.

## Why

The relative-window model (`now − N days`) couldn't express "last June" or
"2025" and had a dead "All" affordance (a ~9999-day sentinel that effectively
meant "everything"). MyFitnessPal refugees and Apple Health users expect the
calendar-anchored grammar; it's also the only model where paging is meaningful.

## Model — the single source of truth

`src/lib/nutrition/progressPeriod.ts` is the shared, React-free, platform-free
period helper. Both platforms import it (mobile via the `@suppr/shared` Metro
alias) so windows and labels can't drift.

- `ProgressPeriod = { type: "D"|"W"|"M"|"6M"|"Y"; offset: number }` — `offset`
  is `<= 0`; `0` is the period containing "now", negative is the past.
- `periodWindow(period, weekStart, now)` → inclusive local `[startKey, endKey]`
  `"YYYY-MM-DD"` window. All arithmetic is **local calendar** (DST-safe — never
  raw milliseconds across a boundary; honours the user's `week_start_day`).
- `periodLabel` / `periodAdherenceOverline` — the header + card overline copy.
- `progressPeriodToWeightRange` + `periodChartAnchorISO` — bridge the period to
  the `WeightChart` bucket range, anchoring the trailing window to the period's
  end day so paging actually moves the chart window (not always "today").
- Paging helpers (`previousPeriod` / `nextPeriod` / `clampOffsetToPresent` /
  `isCurrentPeriod` / `withPeriodType`) enforce the no-future clamp.

The range stats consumers moved to `*ForWindow` variants in
`progressRangeStats.ts` (`buildWeightRangeStatsForWindow`,
`buildCaloriesRangeStatsForWindow`, `buildMacroAdherenceRangeStatsForWindow`).
The legacy `rangeKey` builders are kept (their pinned tests stay green) but no
Progress surface calls them.

## Empty periods

A period with no logged data renders **honest calm copy**, never a faked `0%`:
the AVERAGE ADHERENCE card simply doesn't render when `daysLogged === 0`, and
the range stats return `null` / `[]`. Verified in the sim on an empty past day
(Day view paged back to an unlogged date — the calibrating card + weight trend
show; no invented adherence bars).

## Parity

- **Web:** `src/app/components/suppr/progress-period-control.tsx` — segments +
  paging + keyboard arrow movement on the tablist; an optional `usePeriodSwipe`
  pointer accelerator (swipe optional on web per the spec).
- **Mobile:** `apps/mobile/components/progress/ProgressPeriodControl.tsx` —
  identical segments + paging + `selection` haptics. **Chevrons are the only
  wired paging affordance today;** a horizontal chart swipe is a tracked
  enhancement (**ENG-1031**), not a gap — the chevrons fully satisfy paging and
  are the accessible path (design-system rule: swipe must never be the *only*
  path, so chevrons-first is correct).

Both surfaces use `DEFAULT_PERIOD = { type: "W", offset: 0 }` and the same
shared helper, so the two stay in lock-step.

## Tests

- `tests/unit/progressPeriod.test.ts` — 55 exhaustive cases: month lengths
  (Feb leap/non-leap, 30/31-day), year wrap, 6M Jan–Jun/Jul–Dec anchoring,
  week-start (monday/sunday), DST-safe windows, paging clamps, labels, the
  inclusive window filter, and an offset sweep (start ≤ end, never future).
- `tests/unit/progressPeriodControl.test.tsx` (web) +
  `apps/mobile/tests/unit/progressPeriodControl.test.tsx` (mobile) — render +
  interaction: segment switch resets to current, prev/next paging, disabled
  forward chevron at the present, label updates, a11y state, web keyboard
  arrows + `usePeriodSwipe`.
- `apps/mobile/tests/unit/progressRangePicker.test.ts` — structural pins:
  period control wired on both platforms, old `rangeKey`/`rangeDays`/pill
  source gone, skeletons mirror the period control, one-vertical-rhythm sweep
  held.

## Related — one vertical rhythm sweep (same change)

The Progress range-picker seam carried a `marginBottom: Spacing.md` *outside*
the gap container, so the picker→card seam read ~5–16pt while the page breathed
at 20pt. Fixed by wrapping the picker + THIS WEEK card in the `heroEntrance`
gap container (`gap: Spacing.lg`, matching the charts/details wrappers and the
scroll container) and dropping the self-margins from the skeleton rows and the
`WeightTrendOnlyCard`. One rhythm per page; tokens only.
