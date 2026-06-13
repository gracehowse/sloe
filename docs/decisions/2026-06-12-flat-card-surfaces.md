# Flat-card surfaces (Withings grammar)

**Date:** 2026-06-12
**Status:** Resolved — **Grace approved the red-line 2026-06-12** ("go for the flat cards")
**Area:** Design system — card elevation, both platforms
**Supersedes:** the soft-lift half of `docs/decisions/2026-06-09-one-card-treatment-soft-elevation.md` (ENG-1005). The 2026-06-09 cream-ground/white-card material inversion **stays**.
**Linear:** ENG-1078 (implementation guide on the issue) · converges with TF57 F-160/F-166/F-176/F-177 (ENG-1064/1065 residuals)
**Rollout mechanism — UNGATED (revised at implementation, 2026-06-12):** the planned `flat_card_surfaces` flag was **not used and has been deleted from PostHog**. At implementation we found Grace's standing elevation directive recorded in `useCardElevation.ts` ("turn everything on; never flag-gate again" — the prior elevation flag only ever hid the design from the founder), so the treatment shipped directly at the two primitives, exactly like the 2026-06-04 flat-slabs and 2026-06-09 soft-lift waves before it. Rollback = revert the two-primitive commit.

## Decision

Grace (from Withings screenshots + Mobbin study): *"they use flat white cards not elevated — I think we should follow this, it's cleaner. No border though. They also use a grey background it seems for toggles and other flat coloured cards."*

1. **Page-ground cards: flat.** White `--card` on the cream ground, **zero box-shadow, zero border** — separation comes from ground↔card contrast alone. The `0 6px 18px rgba(34,27,38,.16)` soft lift is retired (ungated — see Rollout mechanism above; guard tests pin the flat treatment).
2. **Nested affordances: quiet fill.** Interactive rows inside cards (add-food rows, "show all" affordances, toggles, sub-tiles) sit on a new quiet-fill token — light `#F2EFE9` — not on a second white card and not behind borders. Dark-mode value derived from the background-secondary family (designed, not inherited).
3. **Unchanged:** cream ground (brand equity — deliberately NOT Withings' cooler grey), CARD_RADIUS/TILE_RADIUS=24 carve-outs, one-filled-CTA rule, calorie-ring colour mapping.

## Why

- TF57 founder feedback converges on it: F-160 ("whole section very ugly… go back to pre-redesign with updated colours/fonts") is the white-slab-with-lift meal sections; F-166 "dull", F-176/177 "inconsistent treatment" — the lift halo is the styles-fighting residue.
- Reference grammar verified on Mobbin (Withings Health Mate): [home](https://mobbin.com/screens/3e0d9ab3-1658-4490-8738-6c7f90940729) · [measure](https://mobbin.com/screens/5ee3baa3-689f-4248-8ba8-69aaec2a6c1f) · [tinted tiles](https://mobbin.com/screens/a168eb87-20a4-420b-a134-f6d3208f996d).
- Red-line: `docs/design-explorations/2026-06-12-flat-cards-withings/{prototype.html,redline.png}` — approved.

## Rollout

Revised at implementation: tokens + primitive flip (mobile `useCardElevation`, web `.card-slab`/`.card-elevated`) → per-tab straggler census (13 flattened; overlays/sheets/FAB/segmented-thumbs sanctioned — transient surfaces keep elevation) → F-160 meal-section density retune + first quiet-fill adoptions (Add-food rows, LogSheet footer, planner slot pills) → light+dark captures per tab → Grace eyeball on the captures → second PR: full quiet-fill census/migration + `Targets.tsx` legacy micro-shadow conversion. All ungated; guard tests pin the flat treatment so the lift cannot silently return.
