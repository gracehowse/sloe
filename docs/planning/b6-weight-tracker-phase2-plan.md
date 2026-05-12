# B6 Phase 2 — Steps / Water / Body fat migration plan

**Date:** 2026-05-11
**Status:** Scoped, ready to implement when PR #230 (Phase 1) merges
**Decision parent:** [`docs/decisions/2026-05-11-weight-chart-consolidation-plan.md`](../decisions/2026-05-11-weight-chart-consolidation-plan.md)

## What Phase 2 ships

Three sections from `/weight-tracker` migrate (or get dropped). After
Phase 2 ships, the route can be deleted by Phase 3 with zero data loss.

| Section | Current state on /weight-tracker | Progress coverage today | Burn detail coverage today | Usage signal | Verdict |
|---|---|---|---|---|---|
| **Steps** | Bar chart + display only (no input) | ✅ Full — "Steps Today" card with goal + sync state | Read-only row | Auto-synced from Apple Health (no manual log) | **DROP** |
| **Water** | Bar chart + display (no input on this surface — input lives on Today) | ❌ None | ❌ None | Manual only via Today's water meter | **MIGRATE to Progress** as a new "Water intake" card mirroring Steps Today |
| **Body fat** | Scalar % + manual input + Save | ❌ None | ❌ None | Hybrid (Apple Health can supply; manual entry also active) | **MIGRATE to Progress** as a new scalar card with input form mirroring the new LogWeightSheet pattern |

PostHog telemetry: zero events fire from `/weight-tracker` itself. The
route is dark — there's no observed usage signal to argue against
deletion.

## Implementation outline

### 1. Drop the Steps section
- Progress already has `"Steps Today"` (`apps/mobile/app/(tabs)/progress.tsx:1832`).
- Burn detail already has steps as a read-only row.
- The historical bar chart on `/weight-tracker` is redundant — nobody
  asked for a steps history view, and the only data source is auto-sync.
- Action: nothing to migrate. Just delete with the route in Phase 3.

### 2. Migrate the Water section into Progress
- New `<WaterCard />` on Progress, sourcing `extra_water_by_day` from
  `profiles`. Same shape as the existing Steps Today card: today's
  ml + goal ring + a chart toggle.
- Logging stays on Today (the existing `addWaterMl` callback in
  `(tabs)/index.tsx:3033`). Progress is a read view — users log on
  Today, see history on Progress.
- Render gate: only show the card if the user has at least one logged
  water entry (otherwise it's noise — same gate that hides empty
  weight chart).

### 3. Migrate the Body fat section into Progress
- New `<BodyFatCard />` on Progress, sourcing `body_fat_pct` +
  (future) a `body_fat_pct_by_day` JSONB column for history.
- Today, `body_fat_pct` is a single scalar with no history map.
  Phase 2 just surfaces the scalar + input form on Progress; a
  separate Phase 2b can add `body_fat_pct_by_day` if we want a chart.
- Reuse the new LogWeightSheet pattern (modal sheet with input +
  optimistic-update + rollback on error) for the input form. Mount
  via the same `setLogWeightOpen`-style state on Progress.

## Files

| File | Change |
|---|---|
| `apps/mobile/components/progress/WaterCard.tsx` | NEW — read view of extra_water_by_day |
| `apps/mobile/components/progress/BodyFatCard.tsx` | NEW — scalar + tap-to-open `<LogBodyFatSheet>` |
| `apps/mobile/components/progress/LogBodyFatSheet.tsx` | NEW — input sheet following the LogWeightSheet pattern |
| `apps/mobile/app/(tabs)/progress.tsx` | Add the two cards above the existing weight section; add the sheet state + mount |
| `apps/mobile/tests/unit/progressPhase2Wiring.test.ts` | NEW — pin that both cards mount + sheets open |

## Out of scope for Phase 2

- Body fat history chart (needs a new JSONB column on `profiles` —
  separate migration; deferred to Phase 2b if there's demand)
- Water input on Progress (logging stays on Today, parity-preserved)
- Steps chart (dropped — covered by existing Today + Burn detail)

## Phase 3 unblockers

Once Phase 2 ships, Phase 3 can do:

- Delete `apps/mobile/app/weight-tracker.tsx`
- Delete `apps/mobile/app/_layout.tsx` Stack.Screen + title +
  hidden-header registrations
- Delete `apps/mobile/.maestro/14_weight_tracker.yaml`
- Delete `apps/mobile/e2e/14-weight-tracker.test.ts`
- Delete `apps/mobile/tests/unit/weightJourneyIconsNoEmoji.test.ts`
- Remove `weight-tracker` line from
  `apps/mobile/scripts/capture-every-route.sh`
- Remove `weight-tracker` deeplink + capture from
  `apps/mobile/.maestro/00_screenshot_tour.yaml`

## Risk + revert

If a user reports the missing /weight-tracker route post-Phase 3:
revert the Stack.Screen removal only. The route file is deleted but
the underlying data (profiles JSONB columns) is untouched. Restoring
the route file from git history is a 5-minute revert.
