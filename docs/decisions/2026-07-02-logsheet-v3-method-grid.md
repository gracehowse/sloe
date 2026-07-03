# Decision — Log sheet v3 method-grid + "Add to today" header (ENG-1303)

**Date:** 2026-07-02
**Area:** Product / Today (Log sheet) / v3 conformance / cross-platform parity
**Status:** Shipped (default-ON behind `sloe_v3_log`)
**Prototype:** `docs/ux/redesign/v3/Sloe-App.html` LogHub `.method-grid` (L2040–2050, L3768–3812)
**Closes:** the LogHub method-grid + title conformance items in
`docs/ux/redesign/v3/conformance-backlog.md` (§ "🔒 LogHub — search-first IA").

## Decision (Grace, 2026-07-02)

1. **Adopt the v3 method-grid TILE grammar** for the Log-sheet input-method row,
   behind a new flag `sloe_v3_log` (default-ON per the beta-window "always flag
   on" policy — the solo tester must see her own features). The legacy circular
   input chips stay alive in the flag-off `else` as the kill switch, byte-for-
   byte the pre-ENG-1303 render.
2. **Add Describe as a first-class method tile.** Do **not** add `Label`: no
   scan-nutrition-label / OCR flow exists yet, so shipping a `Label` tile would
   be a dead affordance. A follow-up ticket covers scan-label. Omitting it is a
   deliberate scope call, not a conformance gap.
3. **Change the sheet header** from "Log a meal" to **"Add to today"** on both
   platforms, behind the same `sloe_v3_log` flag (legacy copy in the else).

## What shipped

**Method grid (flag ON):** 5 equal-width rounded tiles on the *secondary*
surface, in prototype order **Scan / Photo / Voice / Describe / Quick add**:

- Tile: `bg-secondary` (web) / `colors.backgroundSecondary` (mobile) — the
  recessed surface, **not** the elevated white card; radius **12** (the nearest
  legal `Radius` value to the prototype's off-scale 14px); vertical padding 12
  (`Spacing.dense`), horizontal 4 (`Spacing.xs`), icon→label gap 8 (`Spacing.sm`).
- Icon in plum (`text-primary-solid` / `accent.primary`), 22px; label 11/600 in
  the foreground text token.
- **Lock badge** (`.prolock`): an 18px circular frost badge top-right
  (`bg-muted` / `colors.fillQuiet`) with a small lucide `Lock` glyph (11px, plum)
  — **replaces the "PRO" text pill** on locked AI methods (Voice / Photo). The
  legacy PRO pill survives only in the flag-off circular-chip render.
- The ENG-1252 first-session AI-method tooltip still anchors under the first
  locked AI tile (unchanged behaviour, now inside the grid).

**Describe wiring:** the Describe tile calls a host-owned `onDescribe` callback.
Unlocked → it expands the inline describe flow *empty* via a new `expandSignal`
prop on `LogSheetDescribeFlow` (distinct from the existing `seedText`, which
pre-fills from the search-row NL CTA). Locked → the host paywalls, exactly as the
collapsed describe entry already does. The row stays tier-agnostic — all lock
logic lives in the host.

**Header:** `"Add to today"` when `sloe_v3_log` is on; `"Log a meal"` when off.

## Why gate a default-ON flag at all

Per the CLAUDE.md feature-flag non-negotiable, visual/structural changes ship
behind a flag with the old path alive in the `else`, so the change can be rolled
back from PostHog without a deploy. `sloe_v3_log` is that kill switch: the
flag-off path renders the exact pre-ENG-1303 circular chips + "Log a meal" header
(pinned by tests), so a regression is one PostHog toggle away from reverting.

## Deliberate deviations from the prototype

- **`Label` tile omitted** — no OCR/scan-label flow exists (see above). Follow-up
  ticket, not a gap.
- **Radius 12, not 14** — 14 is off the Sloe radius scale {4,6,8,12,full}; 12 is
  the nearest legal token (design-craft contract: tokens only, no off-scale).
- **Horizontal tile padding 4 (not the prototype's 6)** — 6 is off the spacing
  scale {4,8,12,…}; 4 and 8 are equidistant, and 4 keeps the tight prototype feel
  while preserving label room in a 5-tile row on a narrow sheet. Same on both
  platforms.
- **Lock glyph in plum (`accent.primary` / `text-primary-solid`), not the
  prototype's damson `--primary-active`** — matches the tile icon hue and clears
  AA on the light frost badge; a cohesion + a11y call.

## Files

- Flag: `src/lib/analytics/track.ts` + `apps/mobile/lib/analytics.ts`
  (`REDESIGN_DEFAULT_ON`, mirror entries).
- Web row: `src/app/components/suppr/log-sheet-input-mode-row.tsx`;
  header + describe wiring: `src/app/components/suppr/log-sheet.tsx`;
  describe flow: `src/app/components/suppr/log-sheet-describe-flow.tsx`;
  extracted CTA: `src/app/components/suppr/log-sheet-barcode-free-promise.tsx`.
- Mobile row: `apps/mobile/components/today/LogSheetInputModeRow.tsx`;
  header + describe wiring: `apps/mobile/components/today/LogSheet.tsx`;
  describe flow: `apps/mobile/components/today/LogSheetDescribeFlow.tsx`;
  extracted CTA: `apps/mobile/components/today/LogSheetBarcodeFreePromise.tsx`.
- Tests: `tests/unit/logSheetInputModeRowV3.test.tsx` +
  `apps/mobile/tests/unit/logSheetInputModeRowV3.test.tsx` (flag-ON tile grammar
  vs flag-OFF circular chips + header swap + Describe expand/paywall);
  parity assertions in `tests/unit/logSheetWebMobileParity.test.ts`;
  flag parity in `tests/unit/redesignDefaultOnParity.test.ts`.

## Note on the barcode-free-promise extraction

`log-sheet.tsx` (both platforms) is pinned by the screen-line ratchet and may
only shrink. To land the method-grid wiring without growing past the pin, the
loud "Scan a barcode" CTA + free-forever line were extracted verbatim into a
sibling `LogSheetBarcodeFreePromise` component on each platform (a
presentation-only move; the host wires it exactly as before). Both `log-sheet`
files now sit under their pins.
