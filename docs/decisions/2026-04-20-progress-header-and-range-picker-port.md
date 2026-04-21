# Progress tab — header + range picker port (prototype, phase 1)

**Status:** Resolved (shipped 2026-04-20)
**Area:** UI / parity
**Owner:** product-engineer

## Context

Grace's 2026-04-20 screenshot review flagged that the Progress tab on
both platforms (a) was stuck on a skeleton loader when her account
hit a transient supabase error, and (b) the visible header read
"Progress / Weekly report" rather than the 2026-04-19 Claude Design
prototype treatment:

- uppercase range overline (e.g. `LAST 30 DAYS`),
- large 28pt bold "Progress" title (-0.6 tracking),
- round calendar-icon button in the top-right,
- horizontal `[7d / 30d / 90d / All]` pill row below the header.

Prototype reference:
`docs/prototypes/2026-04-19-whole-app-experience/project/screens-mobile.jsx`
→ `ProgressScreen`, lines 549 onwards.

Both existing screens (`apps/mobile/app/(tabs)/progress.tsx` at 1573
lines and `src/app/components/ProgressDashboard.tsx` at 1399 lines)
carry substantial real content below the fold — stat grid, weekly
recap card, maintenance chain explainer, weight journey card, adaptive
TDEE breakdowns, Apple Health sync, freeze ledger, etc. A full
prototype card-level match would require deleting real features that
`product-lead` has explicitly scoped in.

## Decision

Ship the header + range-picker treatment + skeleton-gate fix in this
pass. Defer the deeper card restructure (sparkline weight card,
calories / protein bar cards in the exact prototype shape) to a
follow-up.

### What shipped

1. **Skeleton-gate fix.** The prior shape of `loadData` (mobile) and
   `load` (web) had no `try/catch` around the supabase fetch. A thrown
   network error mid-call exited the function before `setLoading(false)`
   ran, pinning the skeleton (mobile) or "Loading progress…" line
   (web) indefinitely. Both are now wrapped in `try/finally` so the
   loading flag ALWAYS flips once, even on the sad path. The happy-path
   `setLoading(false)` call that sits before the deferred
   `daily_targets` fetch is preserved so the H-4 first-paint ordering
   pin (`tests/unit/progressSkeletonSource.test.ts`) keeps holding.

2. **Header.**
   - Overline reflects the selected range
     (`rangeLabel = LAST 7 DAYS | LAST 30 DAYS | LAST 90 DAYS | ALL TIME`).
   - 28pt bold title "Progress" with -0.6 tracking.
   - Round 36x36 calendar-icon button top-right (Ionicons
     `calendar-outline` on mobile, lucide `CalendarDays` via a new
     `Icons.calendar` alias on web). Mobile tap routes to
     `/weight-tracker` as the nearest existing date-driven surface; a
     dedicated date-range modal is a follow-up.

3. **Range picker.**
   - Mobile: new `rangeKey` state (`"7d" | "30d" | "90d" | "all"`,
     default `"30d"`). Pills render as full-pill rounded buttons; the
     active pill is filled with the primary accent.
   - Web: the existing `range` state (previously `"1W" | "1M" | "3M" |
     "6M" | "All"` with no UI to switch) was renamed to the same
     `"7d" | "30d" | "90d" | "all"` tuple. `rangeDays` arithmetic was
     updated accordingly and still drives the weight + steps chart
     windows already present below the picker.

4. **Skeleton parity.** Both surfaces now render the prototype header
   chrome inside the `loading` branch so the first paint matches the
   post-load layout (no jump). Web additionally gets a 4-tile
   placeholder grid; the `Loading progress…` text-only line is gone.

### What was intentionally deferred

- Sparkline weight card, calories bar card, protein bar card in the
  prototype's exact shape (bordered, 14px radius, 14px padding,
  17pt title, 12pt muted subtitle, macro colours from `MacroColors`).
  The existing cards are left in place.
- Replacing the daily-calories bar chart, macro adherence chart, and
  streak-freeze panel with prototype equivalents.
- Apple Health sync card prototype-styling pass.
- A dedicated date-range picker modal behind the calendar button.

These items will be covered in a phase-2 port once we've confirmed
the header + range-picker lands cleanly with Grace.

### What did NOT change

- Analytics events, PostHog wiring, and event names.
- `loadData` / `load` data shape (unchanged — same columns, same
  fan-out).
- `weightProjection`, `computeProtectedStreak`, `buildWeekStats`,
  `resolveMaintenance`, and the shared nutrition helpers.
- The weekly recap card, deep-link to save-combo, and usual-meal
  insight flow.

## Parity

| Surface | Header | Range picker | Skeleton |
|---------|--------|--------------|----------|
| Mobile (`apps/mobile/app/(tabs)/progress.tsx`) | Yes | Yes (`rangeKey`) | Prototype chrome + 4 skeleton tiles + spinner |
| Web (`src/app/components/ProgressDashboard.tsx`) | Yes | Yes (`range`) | Prototype chrome + 4 skeleton tiles |

No intentional divergence on this pass. Both default to `30d`, both
expose the same pill labels (`7d`, `30d`, `90d`, `All`), and both use
matching overline copy.

## Tests

- `apps/mobile/tests/unit/progressRangePicker.test.ts` (new) — pins
  the header + range-picker + skeleton-gate shape on both platforms.
- `apps/mobile/tests/unit/progressSkeletonSource.test.ts` (existing) —
  continues to pin the H-4 first-paint ordering (happy-path
  `setLoading(false)` before deferred `daily_targets` fetch).
- `apps/mobile/tests/unit/progressSkeletonFirstPaint.test.tsx`
  (existing) — continues to pin the skeleton-first paint with the
  pending-supabase mock.
- Mobile e2e assertions (`apps/mobile/e2e/07-progress.test.ts`,
  `apps/mobile/e2e/01-navigation.test.ts`,
  `apps/mobile/e2e/27-progress-metric.test.ts`) and Maestro flows
  (`apps/mobile/.maestro/07_progress.yaml`,
  `apps/mobile/.maestro/01_navigation.yaml`) updated from
  "Weekly report" to the new range overline.

## Follow-ups

Owner: `ui-product-designer` + `product-engineer`.

1. Phase-2 card restructure — sparkline weight card, calories /
   protein bar cards in the prototype shape.
2. Dedicated date-range picker modal behind the calendar button.
3. Thread the selected range through the card-level windows that
   currently use their own scoped windows (weekly recap = week,
   maintenance explainer = configurable).
