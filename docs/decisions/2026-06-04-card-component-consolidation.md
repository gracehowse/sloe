# One card component (`<SupprCard>`) + soft lift bumped to 10%

- **Date:** 2026-06-04
- **Area:** Design system / mobile Today + Progress (+ web parity)
- **Status:** Resolved
- **Trigger:** Grace (founder): "push it to 10% also — the cards are being handled
  separately for some reason — each card looks slightly different, they should all
  be the same component updated at once."
- **Related:** `docs/decisions/2026-06-04-card-soft-lift-default-and-ios-shadow-clip-fix.md`
  (the prior per-card clip fix this consolidates), ENG-840 (flag-force dead on
  sim). **Pending Linear follow-up** for the un-migrated surfaces (see below) —
  to be filed when the Linear MCP reconnects; this doc is the interim tracker.

## Problem

Two linked issues, both real:

1. **The soft lift read too faint.** The Sloe resting-card lift was 7% opacity
   (`0 4px 12px rgba(34,27,38,0.07)`). On the sim the `#F6F5F2` card still didn't
   separate confidently enough from the `#FFFFFF` page.

2. **Card chrome was hand-rolled per surface and had drifted.** The prior clip
   fix (2026-06-04) solved the iOS `overflow:'hidden'` shadow-clip bug — but it
   solved it *per card*, by copy-pasting the outer-wrapper-shadow + inner-clip
   pattern into ~6 places. A repo audit found the card chrome was hand-rolled in
   ~12 surfaces with genuine divergence:
   - **radius:** Today hero + macro tiles = `20`; planned-meals / meals-section /
     hydration = `Radius.xl` (12); the Today `styles.card` = `Radius.lg` (8);
     Progress cards = `Radius.lg` (8); activity-bonus inner cards = literal `20`;
     DiscoverHero = `Radius.xl` (12); library cards = `4` / `12` / `15` / `20`.
   - **border:** Progress + the three extracted Progress card components still
     used the heavy `borderWidth: 1` (3 physical px on @3x), the exact "boxed"
     look the hairline sweep was meant to kill.
   - the outer/inner clip split, fill, and padding were each re-derived per card.

   Fixes therefore landed per-card and re-drifted — exactly the founder's
   complaint.

## Decision

1. **Bump the soft lift to 10% on BOTH platforms.** `Elevation.cardSoft` (mobile)
   and `--elev-card-soft` (web, light + dark) move `0.07 → 0.10` opacity and
   `12px → 14px` radius in lockstep (y-offset stays +4; the Sloe plum ink
   `#221B26` is unchanged). Web == mobile is preserved.

2. **`<SupprCard>` is THE card primitive.** Both platforms already had a
   `SupprCard`; it's now the canonical shell and every resting card renders its
   chrome through it. The mobile shell:
   - was rewritten to route through `useCardElevation` (the un-gated source of
     truth) instead of reading the dead `design_system_elevation` flag,
   - encapsulates the outer-wrapper-shadow + inner-clip + dark-hairline + fill +
     radius in ONE place — so the iOS clip bug can never recur per-card again,
   - exposes a small, documented variant API: `size = card` (radius 20, the
     resting card) / `tile` (radius 16, the 2×2 macro tiles) / `inset` (radius
     16, hairline, **no drop shadow** — a sub-panel ON a card, so a card-on-card
     never double-shadows); plus `tone` / `gradient` / `border` / `padding` /
     `style` (outer) / `innerStyle` (inner).

3. **Migrate the Today + Progress card surfaces to the shell.** `TodayHeroRing`,
   `TodayDashboardMacroTiles` (as `size="tile"`), `TodayPlannedMealsCard`,
   `TodayMealsSection` (per-slot + quick-add cards), `TodayActivityBonusCard`
   (outer card + the burn-breakdown / 7-day-rolling sub-panels as `size="inset"`),
   `HydrationStimulantsCard`'s `SloeCard`, and the Progress `TrajectoryCard`,
   `TrendSummaryCard`, `DigestStoryCard`, and `progress-3-stat-row` now all
   render through `<SupprCard>`. Same fill (`#F6F5F2`), same radius (20), same
   lift everywhere. Only the chrome unified — each surface's inner contents are
   byte-unchanged.

## Judgement calls (stated, not silent)

- **Macro 2×2 tiles → `size="tile"` of the shell**, not a bespoke exception. They
  ARE the same component, just a smaller corner (16) + tighter padding. One
  documented variant beats a one-off.
- **Inner sub-panels (burn-breakdown, 7-day-rolling) → `size="inset"`.** A
  card-on-card must not stack a second drop shadow, so `inset` carries a hairline
  + fill (its separation) and no shadow. Documented variant, not a silent special
  case.
- **`DiscoverHeroCard` stays hand-rolled — intentional exception.** It's a
  full-bleed editorial IMAGE hero with its own dark fill (`#1c1916`) + gradient
  scrim, so it can't use the neutral `#F6F5F2` shell. It now shares `CARD_RADIUS`
  (20) + the same `useCardElevation().shadowStyle` lift (imported from the shell)
  so it sits consistently.
- **Web keeps the `design_system_elevation` gate; mobile dropped it.** On web,
  flag-FORCE works, so the gate (resolves ON by default) is kept to preserve the
  pre-redesign visual-capture path web tests exercise in both flag states. On
  mobile the gate is dead on the sim (ENG-840), so it was dropped. Both render
  the identical 10% lift in production. Intentional divergence, not drift.
- **Recipes tab (`library.tsx`) not migrated this pass — tracked, not silent.**
  Its recipe-grid cells + import rows have their own grid semantics and the
  widest radius drift (4 / 12 / 15 / 20). Migrating them is a **pending Linear
  follow-up** (to be filed on MCP reconnect — title + scope in "Pending Linear
  mirror" at the bottom of this doc) so the consolidation isn't quietly
  half-done. The `index.tsx` legacy `styles.card` entry is now unused (its
  consumers migrated) and is left in place for the 3.4k-line screen file; folded
  into the same follow-up.

## Tests

- `apps/mobile/tests/unit/supprCardShell.test.tsx` (new) — renders `<SupprCard>`
  and pins the contract: testID/fill/radius/lift on the OUTER node, clip on a
  SEPARATE inner node with no shadow, `tile`/`inset` radii, `inset` has no drop
  shadow, dark = tonal lift + hairline.
- `apps/mobile/tests/unit/cardElevationSoftLiftDefault.test.tsx` — updated: pins
  `Elevation.cardSoft` at **0.16 / 18px / y+6** (bumped 0.10 → 0.16 on 2026-06-04
  after edge-pixel sampling proved the 10% lift still read too weak on-device)
  and that it matches `--elev-card-soft` web EXACTLY
  (`0 6px 18px rgba(34, 27, 38, 0.16)`); the iOS-clip section now asserts the fix
  lives in the shell + the migrated surfaces route through it.
- `apps/mobile/tests/unit/sloeCardHairlineBorders.test.tsx` — updated: split into
  "shell owns the hairline", "migrated → routes through `<SupprCard>`", and
  "still-hand-rolled → keeps the hairline pin" (the un-migrated surfaces in the
  pending follow-up).
- `apps/mobile/tests/unit/supprPrimitives.test.tsx` — updated `border=false` to
  read the inner (clip) node (border moved there in the two-node shell).

## Parity

Web `--elev-card-soft` bumped to 10% in lockstep (light + dark). Web already
routes resting cards through its own `SupprCard`; the only intentional
web/mobile implementation difference is the elevation flag gate (above).

## Pending Linear mirror (MCP not connected this session)

File under **Engineering → Platform foundations → Design system cleanup**:

- **Title:** Card consolidation — migrate remaining surfaces (Recipes tab +
  Progress inline cards) to `<SupprCard>`
- **Body:**
  - Recipes tab `apps/mobile/app/(tabs)/library.tsx` — recipe-grid cells +
    import rows (widest radius drift: 4 / 12 / 15 / 20). Image cells may need the
    `DiscoverHeroCard` image-hero treatment (share `CARD_RADIUS` +
    `useCardElevation().shadowStyle`, keep own fill).
  - `apps/mobile/app/(tabs)/progress.tsx` — ~18 remaining inline card blocks
    (skeletons, chart cards, journey card) still using `borderWidth: 1` (heavy)
    + `Radius.lg` (8). Migrate to `<SupprCard>`.
  - `apps/mobile/app/(tabs)/index.tsx` — remove the now-unused `styles.card`
    StyleSheet entry once the screen file is refactored.
  - Remaining hand-rolled resting cards in `sloeCardHairlineBorders.test.tsx`'s
    `HAND_ROLLED` list: `TodayDashboardMacroBars`, `TodayFirstMealEmptyState`,
    `ProgressHeadline`, `ProgressStoryGate`, `RemainingMacrosBar`.
  - **Done =** every resting card renders through `<SupprCard>` (or is a
    documented image-hero exception), the `HAND_ROLLED` list is empty, and no
    card hand-rolls `borderRadius` / `borderWidth: 1`.

