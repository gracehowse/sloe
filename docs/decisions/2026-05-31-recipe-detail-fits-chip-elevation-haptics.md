# Recipe detail — "Fits your day" payoff chip + soft-elevation cards + commit haptics (web + mobile)

**Date:** 2026-05-31
**Status:** Resolved (both platforms implemented; flags OFF pending sim/desktop sign-off)
**Area:** Recipes / Recipe detail / Brand consistency
**Flags:** `design_system_colours`, `design_system_elevation`, `redesign_winmoment` (visual/structural → flag-gated per CLAUDE.md)
**Issues:** [ENG-818](https://linear.app/suppr/issue/ENG-818), [ENG-819](https://linear.app/suppr/issue/ENG-819)
**Initiative:** Redesign — Design Direction 2026
**Direction:** [`2026-05-31-design-director-review-and-direction.md`](2026-05-31-design-director-review-and-direction.md)

## The gap

The design-director review judged the recipe-detail screen as dropping from
the strong home-surface bar to "competent tracker" — three specific tells:

1. **The "Fits your day · ≈N%" line read as flat grey footnote metadata.**
   This is the single moment a user learns whether a recipe works for their
   day — the payoff of the whole "what to eat next" north-star — and it
   rendered like an afterthought below the macro tiles. `computeFitsYourDayVerdict`
   already produces a tone-aware verdict (`success / warning / destructive`),
   but neither platform gave it visual weight.
2. **The resting detail cards used a hand-rolled hairline border** as a depth
   substitute (mobile `styles.card` `borderWidth: 1`; web `border border-border`),
   diverging from the one-elevation-model spine rule (soft ambient shadow, no
   border).
3. **The commit CTAs fired no feedback.** Tapping "Log all" / "Log" /
   "Start Cooking" committed data silently — no haptic on mobile, no press
   payoff on web.

## The decision

### (1) "Fits your day" payoff chip — `design_system_colours`

The flat coloured-text line is promoted to a real tinted pill on both platforms:

- **Fits well** (`verdict.fits`, ≤50% of the day) → the **dedicated landmark WIN
  amber** (`Accent.win` / `Accent.winSoft` on mobile; `--accent-win` /
  `--accent-win-soft` on web). This is exactly the reserved "genuine win" use the
  win-colour token exists for (spine rule 3) — not generic success-green. The fit
  verdict landing well *is* the recipe-detail win moment.
- **Over half** (51–99%) → warning-amber tint.
- **Over a full day** (≥100%) → destructive-red tint.

The chip keeps the `recipe-fits-your-day` testID, the `Check` glyph when it fits,
and the full `role="status"` / `accessibilityLabel={verdict.a11y}` a11y contract.
Logic stays entirely in `computeFitsYourDayVerdict` — presentation only.

### (2) Soft-elevation detail cards — `design_system_elevation`

- **Mobile:** the resting `styles.card` now consumes `useCardElevation()` — soft
  `Elevation.cardSoft` shadow + no border (light), tonal lift + hairline (dark),
  today's flat/hairline card (flag off). These cards don't clip their children, so
  the shadow rides the card directly (no outer wrapper, unlike the image-clipping
  library cards). The `StyleSheet` `useMemo` now depends on `cardElevation` so it
  re-derives on a flag flip.
- **Web:** the three resting section cards (ingredients, steps, micronutrients)
  swap `border border-border` for `shadow-[var(--elev-card-soft)] border-0`
  when the flag is on (`cardElevationClass`), keeping the border when off.

### (3) Commit CTA feedback — `redesign_winmoment`

- **Mobile:** the in-body "Log" and "Start Cooking" CTAs become `PressableScale`
  with the quiet `confirm` haptic (`ImpactFeedbackStyle.Light`, <100ms). The
  sticky-footer "Log all" — the whole-recipe **landmark** commit on this screen —
  earns the heavier `success` notification haptic. Flag off → `haptic="none"`
  (the old silent commit). These CTAs were already blue `Accent.primary`, so
  `design_system_colours` introduces no colour change there — they are
  intentionally not gated on it.
- **Web:** has no Haptics API, so the analog is a press payoff — `active:scale-[0.97]
  active:brightness-110` over 200ms (`commitCtaPayoffClass`) on the commit CTAs
  (top-bar Cook, Start Cooking, I Made This), gated on `redesign_winmoment`. Flag
  off → existing hover-only transition.

## Parity

Both platforms updated in the same change.

- **Intentional divergence (documented, not drift):** the web recipe-detail screen
  has **no "Log all" / "Log to journal" commit button** — logging a recipe to
  today's journal is a **mobile-only flow** on this surface (web logs via the Today
  tracker). So the web commit CTAs that receive the press payoff are
  Cook / Start Cooking / I Made This, not Log. The fit chip and the soft-elevation
  cards are at full parity.

## Tests

- `apps/mobile/tests/unit/recipeDetailV3SourcePins.test.ts` — flag-gated chip
  (win-amber when it fits, warning/destructive tones, `Radius.full` pill, a11y on
  both paths), `useCardElevation` wiring, and the `PressableScale` confirm/success
  haptic on all three commit CTAs. The legacy flat-line path is pinned separately.
- `tests/unit/recipeDetailLayoutWeb.test.tsx` — the web mirror of all of the above
  (chip token, `cardElevationClass`, `commitCtaPayoffClass`).

## Rollout

All three flags start OFF (old path live in the `else`). Solo-tester ramp to 100%
immediately after sim (mobile) + desktop/mobile-web (web) visual sign-off, per the
P0 flag-inventory plan. Remove the gates two weeks after 100% with no regression.
