# Sloe card soft-lift is the default + the iOS shadow-clip fix (mobile)

- **Date:** 2026-06-04
- **Area:** Design system / mobile Today + Progress
- **Status:** Resolved — **default superseded** (see banner)
- **Trigger:** Grace (founder), on the sim: "sim cards are blending into the background, figma does not do this."

> **⚠️ Superseded in part (2026-06-04, "flat slabs" sweep, commit `664df1cb`).**
> The "soft lift is the **default**" decision below was reversed shortly after by
> the Figma `654:2` flat-slab direction: `useCardElevation` and `<SupprCard>` now
> default to **`flat`** (a borderless, shadowless warm slab — the fill is the
> separation), and the **soft lift is the opt-in** for the elevated recipe-card
> surfaces (Discover, Library, recipe detail) via mobile `lift="soft"` / web
> `elevation="card"`. The rest of this decision still holds: the lift is
> **un-gated** (no `design_system_elevation` read), the **iOS shadow-clip fix**
> lives in the `<SupprCard>` shell, and the soft **token** keeps its `0.16 / 18px
> / y+6 / #221B26` tuning. See `docs/decisions/2026-06-04-card-component-consolidation.md`.

## Problem

The Sloe cards (`#F6F5F2` fill) were rendering flat against the `#FFFFFF`
page — only a hairline edge, no lift — so they blended in. The Figma separates
cards from the page with a **soft drop shadow** (a gentle lift), not a heavier
border. Two root causes, both real:

1. **The soft shadow was clipped on iOS.** The most prominent Today cards
   (`TodayMealsSection` per-slot cards, `TodayPlannedMealsCard`,
   `HydrationStimulantsCard`'s `SloeCard`) spread the soft shadow onto the SAME
   `View` that also set `overflow: 'hidden'` to clip its rounded-corner
   children. **iOS clips a view's own shadow under `overflow: 'hidden'`**, so
   the lift was swallowed and the cards read flat. (The `progress-3-stat-row`
   card on the Progress tab had the identical bug — swept too.)
2. **The lift was nominally flag-gated** behind `design_system_elevation`. That
   flag already resolves ON in every bundle via `REDESIGN_DEFAULT_ON`, and
   flag-FORCE is dead in a bundled app (ENG-840 — Metro can't inline a computed
   env key), so the gate could never be exercised to turn it OFF on device
   anyway. It added fragility for no real toggle.

## Decision

1. **Soft lift is the UNCONDITIONAL default in `useCardElevation`** (mobile).
   The hook no longer reads `design_system_elevation`:
   - LIGHT → soft drop shadow (`Elevation.cardSoft`), NO border (the shadow
     carries the separation; Grace earlier rejected the 1pt border as "too
     heavy", so no border comes back).
   - DARK → tonal lift (`cardElevated` bg) + hairline, no shadow (RN renders
     shadows poorly on dark surfaces).
   The flat `Elevation.card` token still exists for any direct consumer; the
   hook simply no longer routes to it. Removing the flag read also keeps the
   hook dependency-free, which matters because ~30 components consume it and
   their tests `vi.mock("@/lib/analytics")` with only `isFeatureEnabled` —
   vitest throws a strict "No export is defined" on any access of an omitted
   flag fn, so a flag read here is the opposite of "trivial to keep".

2. **The iOS overflow-clip is fixed** by splitting each clipping card into an
   OUTER wrapper that carries the shadow (+ background + radius) and an INNER
   `View` that owns the corner-clip (`overflow: 'hidden'` + border). This is
   the pattern `SupprCard` already uses. Cards fixed:
   `HydrationStimulantsCard.SloeCard`, `TodayPlannedMealsCard`,
   `TodayMealsSection` (per-slot cards + the gated-off quick-add wrapper), and
   `app/(tabs)/progress.tsx` `progress-3-stat-row` (same class of bug).

3. **`Elevation.cardSoft` is tuned to match the web token exactly** —
   `#221B26` (aubergine Sloe ink == `rgba(34,27,38)`) at `0.16` opacity, `18`
   radius, `y+6` — mirroring web `--elev-card-soft`
   (`0 6px 18px rgba(34,27,38,0.16)`). A calm, premium, plum-tinted ambient
   lift, not a cheap/harsh Material drop shadow. Keeps web == mobile.

   **Two strength bumps after the initial fix (same day):** the lift shipped at
   `0.07 / 12px / y+4`, was raised to `0.10 / 14px / y+4` ("push it to 10%"),
   and then — because Grace reported the cards **still** blended on-device —
   raised again to `0.16 / 18px / y+6`. The second bump was grounded in
   **edge-pixel sampling of the sim**, which PROVED the shadow was rendering
   (penumbra just below a card dipped `#F6F5F2`→`#EEEEEE`, ~17 lum under the
   white page) but far too weak: the `#F6F5F2` fill sits only ~10 lum below the
   `#FFFFFF` page, so the shadow has to do **all** the separation, and a
   `0.10 / 14px` halo was actually *lighter* than the card at its outer reach.
   At `0.16 / 18px / y+6` the same edge sample dropped to `#E4E3E4` (~28 lum
   under the page) — a confident, still-soft plum penumbra (the wide radius
   keeps it ambient, not a hard floating-card drop shadow). Verified by
   re-sampling the edges + reading the capture before/after on the sim.

The `#F6F5F2` card fill is **unchanged** — it matches the Figma; the problem
was separation, not the fill. The fix was the shadow alone (no fill change, no
page-tone change, no border re-introduced).

## Parity

Behavioural parity holds and is exact. Web `SupprCard` is **also un-gated** —
its resting `elevation="card"` tier renders the `.card-slab` class
(→ `box-shadow: var(--elev-card-soft)`) and `data-soft-elevation="true"`
unconditionally, with no `design_system_elevation` read. The shadow TOKEN is
identical across platforms: mobile `Elevation.cardSoft` and web
`--elev-card-soft` both carry `0.16 / 18px / y+6 / #221B26`, moved in lockstep
and pinned character-for-character by
`cardElevationVariants.test.tsx` (which source-reads the web token).
Verified on 2026-06-04 by `getComputedStyle('.card-slab').boxShadow` ==
`rgba(34, 27, 38, 0.16) 0px 6px 18px 0px` AND a rendered web swatch matching the
sim. Web has no equivalent iOS clip bug (CSS `overflow: hidden` clips child
box-shadows, not the element's own).

## Tests

- `apps/mobile/tests/unit/cardElevationVariants.test.tsx` (renamed from
  `cardElevationSoftLiftDefault.test.tsx` when the default flipped to flat) — the
  hook returns the soft shadow when opted in (`variant: "soft"`, flags-cold), the
  tonal lift on DARK, the `cardSoft` premium-band + plum tint, the **exact `0.16 / 18px / y+6`
  values** (pinned, not a band — the value is the point of the second bump), the
  web↔mobile token match read straight from `theme.css`, and a precise source
  scan that no clipping View co-locates `overflow: 'hidden'` with the shadow on
  the swept cards.
- `apps/mobile/tests/unit/elevationToken.test.ts` — bounds guard (`cardSoft`
  never silently zeroed; `card` stays flat). Comment refreshed: the lift is
  un-gated, not flag-gated.
- Web: `tests/unit/supprPrimitives.test.tsx` + `tests/unit/progressDashboardElevation.test.tsx`
  updated to the **un-gated web SupprCard** reality — the resting `card` tier
  renders `.card-slab` + `data-soft-elevation="true"` with all flags OFF (the
  old "flag OFF → flat" assertions were stale once the web card dropped its flag
  read). The other web token consumers
  (`recipeEditDialogTokenSweep`, `recipeDetailLayoutWeb`, `foodSearchPanelRedesign`,
  `settingsElevationFlag`, `progressDetailRedesign`, `logSheetAddMealElevationMotion`,
  `mealPlannerElevationAndWinPulse`) assert by token NAME, so the value bump
  needed no change there.

## Files

- `apps/mobile/constants/theme.ts` (`Elevation.cardSoft` → `0.16 / 18px / y+6`)
- `src/styles/theme.css` (`--elev-card-soft` light → `0 6px 18px rgba(34,27,38,0.16)`; dark geometry tracked to `0 6px 18px`)
- `apps/mobile/hooks/useCardElevation.ts` (un-gated; unchanged this pass)
- `apps/mobile/components/ui/SupprCard.tsx` (outer-wrapper shadow split; unchanged this pass)
- `apps/mobile/tests/unit/cardElevationVariants.test.tsx` (renamed from `cardElevationSoftLiftDefault.test.tsx`)
- `apps/mobile/tests/unit/elevationToken.test.ts`
- `tests/unit/supprPrimitives.test.tsx`
- `tests/unit/progressDashboardElevation.test.tsx`

### Verification (sim, iOS 26.5, iPhone 17 Pro — edge-pixel evidence)

| Sample | BEFORE (0.10/14/y4) | AFTER (0.16/18/y6) |
|---|---|---|
| Page bg | #FFFFFF (lum 255) | #FFFFFF (lum 255) |
| Card fill | #F6F5F2 (lum 245) | #F6F5F2 (lum 245) — unchanged |
| Penumbra below tile | #EEEEEE (lum 238) | **#E4E3E4 (lum 227)** |
| Gutter between tiles | #EFEFF0 (lum 239) | **#E5E4E6 (lum 228)** |

Captures: `apps/mobile/screenshots/agent/shadow-diag-before-224206.png`,
`shadow-diag-after-224506.png`, `shadow-before-after-sidebyside-224535.png`,
`shadow-diag-after-scrolled-224622.png`, `shadow-tiles-crop-224643.png`; web
parity swatch `shadow-web-cardslab-swatch.png`.
