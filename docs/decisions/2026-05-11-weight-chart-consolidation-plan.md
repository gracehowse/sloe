# Weight chart consolidation — Progress tab canonical

**Date:** 2026-05-11
**Status:** Resolved — Phases 1-3 shipped (ENG-376 completed 2026-06-19)
**Area:** Mobile progress, weight tracking
**Driver:** Grace TF feedback (B6 / F-132): "Multiple weight chart surfaces; pick one."

## Decision

**The Progress tab is the SINGLE canonical surface for the weight chart** on
both web and mobile. The standalone mobile `/weight-tracker` route gets
deleted.

Web is visually consolidated: `src/app/components/ProgressDashboard.tsx`
renders the only web weight chart; no separate `/weight-tracker` page
exists. ENG-376 added a shared web persistence helper so pruning +
adaptive-TDEE refresh now match the mobile hook contract.

## Scope (mobile)

The `repo-auditor` scan against the Progress tab vs `/weight-tracker`
returns:

### Already on Progress tab

- `WeightChart` (with `WeightRangeToggle` time-range selector)
- Weight Journey card (computed progress copy)
- Trend tile + sparse-state "Log weight" CTA
- Header "Scale" icon (currently routes to `/weight-tracker`)

### Unique to `/weight-tracker` (must migrate before delete)

- **Weight logging input** — the actual UI to add today's weight
- **Steps chart** (last 30 days) — may overlap with Burn detail; needs
  audit for duplication
- **Water section** — separate detail card
- **Body fat section** — separate detail card

### Delete list (after migration)

| Path                                                               | Action                                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `apps/mobile/app/weight-tracker.tsx`                               | Delete (812 lines)                                                                             |
| `apps/mobile/app/_layout.tsx` L344 / L379 / L447                   | Remove `weight-tracker` Stack.Screen, title, hidden-header registration                        |
| `apps/mobile/app/(tabs)/progress.tsx` L960 / L1321 / L1963 / L2057 | Replace `router.push("/weight-tracker")` with inline weight-log sheet open / scroll-to-section |
| `apps/mobile/.maestro/14_weight_tracker.yaml`                      | Delete                                                                                         |
| `apps/mobile/.maestro/00_screenshot_tour.yaml` L108 / L111         | Remove `/weight-tracker` deeplink + capture                                                    |
| `apps/mobile/e2e/14-weight-tracker.test.ts`                        | Delete                                                                                         |
| `apps/mobile/scripts/capture-every-route.sh` L107                  | Remove                                                                                         |
| `apps/mobile/tests/unit/weightJourneyIconsNoEmoji.test.ts`         | Delete (pins icons inside the deleted file)                                                    |

## Phased plan

This is too large for a single PR. Splitting:

### Phase 1 — Add inline log-weight sheet on Progress, switch CTAs (small)

- New `<LogWeightSheet />` mounted at the bottom of Progress tab
- 4 CTAs (header Scale, Trend tile, "Log weight" sparse CTA, Weight
  Journey card) open the sheet instead of pushing `/weight-tracker`
- `/weight-tracker` route stays alive for one release (deeplink grace)
- New e2e + unit pin

### Phase 2 — Migrate steps + water + body-fat detail surfaces (medium)

- Audit whether Burn detail page already covers steps drill-down
- If yes: drop from /weight-tracker. If no: surface as detail cards
  on Progress under a "More signals" collapsible
- Same for water + body fat — likely already covered by macro/hydration
  cards on Today + Progress

### Phase 3 — Delete `/weight-tracker` route + tests (cleanup)

- Once Phases 1-2 have shipped and a release has passed without
  /weight-tracker deeplink hits in PostHog, delete the route + Stack
  registration + Maestro/e2e/capture/test files
- Sync-enforcer carve-out logged so the sweep doesn't re-flag missing
  route as drift

## Status

- Phase 1: shipped — Progress owns the inline LogWeightSheet entry point.
- Phase 2: shipped — mobile weight fetch/prune/persist/rollback/refresh is owned by `useWeightData`; Progress, LogWeightSheet, and AllWeightDataSheet consume that shared hook path instead of writing `weight_kg_by_day` directly.
- Phase 3: shipped — the standalone `/weight-tracker` route, Stack registrations, Maestro flow, Playwright e2e, capture entry, and route-only unit pins were removed.
- Web parity: shipped for data-layer behavior via `src/lib/progress/weightData.ts`; the Recharts visual implementation remains intentionally separate from the React Native chart.

## Why not delete in one PR?

`/weight-tracker` is 812 lines and contains the only `LogWeight` input
on mobile. Deleting it without first migrating that UI would
silently break weight-logging. Phasing keeps every step revertible.

## Edit-in-place for past weigh-ins (ENG-748 #9, shipped 2026-05-27)

The Withings-style "All data" sheet (`AllWeightDataSheet`) was originally
read + delete only. A user who mistyped a past weigh-in (e.g. 87 → 187 kg)
could only delete and re-add, and the re-add always landed on today — the
original date was lost.

**Now:** long-pressing a row opens an Edit / Delete action sheet. "Edit"
closes the all-data sheet and reopens `LogWeightSheet` in **edit mode**
(new `editDate` prop) targeting that date. The value changes, the date is
preserved. The scalar `weight_kg` ("latest weight") is only updated when the
edited entry is the newest one — editing an older entry must not clobber the
current weight. Persistence is the existing `profiles.weight_kg_by_day`
JSONB write path (RLS-scoped to `id = userId`); the `{ error }` result is
checked and surfaced via Alert on failure (never ignored).

**Web parity:** none required. Web (`ProgressDashboard.tsx`) logs today's
weight and renders the trend chart, but has no per-day weight-history list
to edit — the editable "All data" list is a mobile-only surface. Noted as a
parity gap, not drift. If web later grows a weight-history list, mirror the
edit affordance there.

## ENG-376 Phase 2/3 consolidation (2026-06-19)

The data layer is now single-source-of-truth on mobile. `apps/mobile/hooks/useWeightData.ts` owns the profile read, JSONB parsing, 400-day prune, optimistic add/edit/delete, rollback on failed persist, and the single post-write `refreshAdaptiveTdeeForUser` call. Call sites no longer reimplement pruning or direct profile persistence.

The deleted route cleanup is complete: `apps/mobile/app/weight-tracker.tsx`, its `_layout.tsx` Stack registrations, `apps/mobile/e2e/14-weight-tracker.test.ts`, `apps/mobile/.maestro/14_weight_tracker.yaml`, and route capture entries are gone. Progress remains the canonical chart surface.

Web keeps its own chart renderer, but `src/lib/progress/weightData.ts` now centralises web weight persistence so `weight_kg_by_day` writes prune to the same 400-day cap and refresh adaptive TDEE through the same service helper rather than writing adaptive columns client-side.
