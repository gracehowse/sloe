# UI anatomy program — owner components (ENG-1662)

Ratified role taxonomy: ENG-1661. This doc tracks the **owner primitives**
built to collapse census drift (workflow `wf_55be8a3a-512`).

## Owners shipped

| Owner | Role | Mobile | Web |
|-------|------|--------|-----|
| **SupprNotice** | NorthStar tints, offline pill, insight/import/empty-week banners | `apps/mobile/components/ui/SupprNotice.tsx` | `src/app/components/ui/suppr-notice.tsx` |
| **SheetShell** | Bottom sheet chassis: `SHEET_RADIUS` 24, `MODAL_OVERLAY_SCRIM`, 36×4 grabber | `apps/mobile/components/ui/SheetShell.tsx` | `src/app/components/ui/sheet-shell.tsx` |
| **IconButton** | Bell / calendar / kebab / close circles (28 / 36 / 40) | `apps/mobile/components/ui/IconButton.tsx` | `src/app/components/ui/icon-button.tsx` |
| **CountBadge** | Sub-tab + segmented count pill | `apps/mobile/components/ui/CountBadge.tsx` | `src/app/components/ui/count-badge.tsx` |
| **SupprRadio** | Plan source + reset-plan radio indicator | `apps/mobile/components/ui/SupprRadio.tsx` | `src/app/components/ui/suppr-radio.tsx` |
| **StepperCircleButton** | ± stepper circles (32 / 40 / 44) | `apps/mobile/components/ui/StepperCircleButton.tsx` | `src/app/components/ui/stepper-circle-button.tsx` |

## Tokens

Mobile: `IconButtonSize`, `SheetGrabber`, `StepperCircleSize` in `apps/mobile/constants/theme.ts`.

Web CSS: `--icon-button-sm/md/lg`, `--sheet-grabber-width/height`, `--stepper-circle-sm/md/lg` in `src/styles/theme.css`.

## Chip geometry (not a single component)

`TrustChip`, `ConfidenceChip`, and `SearchResultConfidenceChip` keep **separate
product roles** (provenance vs TDEE vs search-result tier) but share geometry via
`chipGeometry.ts` / `chip-geometry.ts` — 22pt height, full-radius pill.

## Card grammar follow-ups

- `SkeletonRow` / `SkeletonCard` use `CARD_RADIUS` (24) so loaders match resting cards.
- `Toast` uses `CARD_RADIUS` + `Elevation.float` (transient overlay).

## Migration status (2026-07-22)

**Collapsed into owners:** `SubTabPill` + `SegmentedTrack` badges → `CountBadge`;
`ResetPlanSheet` → `SheetShell` + `SupprRadio` + `SupprNotice`; `PlanSourceSelector`
radio → `SupprRadio`; `PlanEmptyWeekCard` → `SupprNotice`; `ServingStepper` /
`PortionStepper` / `MobileNumberStepper` ± circles → `StepperCircleButton`.

**ENG-1665 Plan-first slice (this wave):** `planner.tsx` chip-sheet grabbers →
`SheetGrabberBar` (ENG-1662 owner). Remaining Plan hand-rolled sheets should
migrate onto full `SheetShell` in follow-up PRs; shrink `check:anatomy` pins as
each surface recomposes.

**Remaining sweep:** migrate remaining hand-rolled sheet grabbers
(~17 mobile surfaces after Plan slice) and icon-button literals to `SheetShell` /
`IconButton`. Screens → Today → web parity after Plan.

## Rule

Every owner reads **tokens only** — screens must not restate chrome.
