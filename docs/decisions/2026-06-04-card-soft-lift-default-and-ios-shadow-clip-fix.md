# Sloe card soft-lift is the default + the iOS shadow-clip fix (mobile)

- **Date:** 2026-06-04
- **Area:** Design system / mobile Today + Progress
- **Status:** Resolved
- **Trigger:** Grace (founder), on the sim: "sim cards are blending into the background, figma does not do this."

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
   `#221B26` (aubergine Sloe ink == `rgba(34,27,38)`) at `0.07` opacity, `12`
   radius, `y+4` — mirroring web `--elev-card-soft`
   (`0 4px 12px rgba(34,27,38,0.07)`). A calm, premium, plum-tinted ambient
   lift, not a cheap/harsh Material drop shadow. Keeps web == mobile.

The `#F6F5F2` card fill is **unchanged** — it matches the Figma; the problem
was separation, not the fill.

## Parity

Behavioural parity holds: web already lifts by default. Web `SupprCard` keeps
its `isFeatureEnabled("design_system_elevation")` read, which resolves ON via
the web `REDESIGN_DEFAULT_ON`, so web cards already get `--elev-card-soft`. Web
has no equivalent clip bug (CSS `overflow: hidden` clips child box-shadows, not
the element's own). The only difference is implementation (mobile dropped the
flag read for RN-mock robustness + the dead env-force); not a behavioural
divergence. The shadow TOKEN is identical across platforms.

## Tests

- `apps/mobile/tests/unit/cardElevationSoftLiftDefault.test.tsx` — the hook
  returns the soft shadow as the LIGHT default (flags-cold), the tonal lift on
  DARK, the `cardSoft` premium-band + plum tint, and a precise source scan that
  no clipping View co-locates `overflow: 'hidden'` with the shadow on the four
  swept cards.
- Existing pins still hold: `elevationToken.test.ts` (`card` flat / `cardSoft`
  real), `sloeCardHairlineBorders.test.tsx` (hairline grammar),
  `designTokensPhase1.test.ts`.

## Files

- `apps/mobile/hooks/useCardElevation.ts`
- `apps/mobile/constants/theme.ts` (`Elevation.cardSoft`)
- `apps/mobile/components/HydrationStimulantsCard.tsx`
- `apps/mobile/components/today/TodayPlannedMealsCard.tsx`
- `apps/mobile/components/today/TodayMealsSection.tsx`
- `apps/mobile/app/(tabs)/progress.tsx`
- `apps/mobile/tests/shims/analytics.ts` (+`isFeatureDisabled`, mirror surface)
- `apps/mobile/tests/unit/cardElevationSoftLiftDefault.test.tsx` (new)
