# Macro-detail + meal-nutrition detail — unify headers + tokenise empty/error states (web + mobile)

**Date:** 2026-05-31
**Status:** Resolved (both platforms implemented; flags OFF pending sim/desktop sign-off)
**Area:** Today / Nutrition detail / Brand consistency
**Flags:** `design_system_colours`, `design_system_elevation` (visual/structural → flag-gated per CLAUDE.md)
**Issues:** [ENG-825](https://linear.app/suppr/issue/ENG-825)
**Initiative:** Redesign — Design Direction 2026
**Direction:** [`2026-05-31-design-director-review-and-direction.md`](2026-05-31-design-director-review-and-direction.md)

## The gap

The design-director review scored the macro-detail group lowest of every group on
**Motion (Cheap)** and **Delight (Cheap)**, and Consistency at Prototype tier. Four
specific tells across the two sibling nutrition-detail screens
(`apps/mobile/app/macro-detail.tsx`, `apps/mobile/app/meal-nutrition.tsx`):

1. **Two header systems + two icon sets across two sibling screens.**
   `macro-detail` used the canonical `PushScreenHeader` (lucide `ChevronLeft`).
   `meal-nutrition` drove the **native stack header** via `navigation.setOptions`
   in single-meal mode (Ionicons `chevron-back` + a header-right "Edit" link) but
   `PushScreenHeader` (lucide) only in slot-aggregate mode. So two sibling screens
   you reach from the same Today surface rendered different chrome and different
   icon families — and within one screen the header even changed by mode.
2. **CTAs were plain `Pressable`s (opacity-only press).** The macro-detail
   "Log a meal" empty CTA and the meal-nutrition "Go back" error CTAs used the
   bare RN press (opacity dip), not the production `PressableScale` micro-interaction.
3. **Flat empty/error states with a generation-old corner radius, and the empty
   macro-detail was a sea of whitespace** — a centred line of text + a floating
   button, no surface, no icon, no structure.
4. **The empty-state CTA was tinted the full saturated macro colour**
   (`backgroundColor: config.color`) — violating the spine "commit = blue"
   action-colour rule.

## The decision

### (1) One header system across both siblings — `meal-nutrition` → `PushScreenHeader`

`meal-nutrition` now renders `PushScreenHeader` (lucide back chevron) for **both**
the single-meal and slot-aggregate modes, exactly like the macro-detail sibling.
The native-stack-header path (`navigation.setOptions` + Ionicons + header-right
"Edit") is deleted; `useNavigation`/`useLayoutEffect` are gone. The "Edit" action
moves into the header `rightSlot` (single-meal mode), and the calorie value pill
stays in the slot-aggregate `rightSlot`. The route is added to
`STACK_HEADER_HIDDEN` in `apps/mobile/app/_layout.tsx` (same fix shape as
`macro-detail` / `burn-detail`) so the auto-stack header doesn't double up.

**Icon set unified to lucide:** the screen's Ionicons (`chevron-back`,
`nutrition-outline`, `alert-circle-outline`) are replaced — the back chevron comes
from `PushScreenHeader` (lucide `ChevronLeft`), and the empty/error glyphs are
lucide `Salad` / `CircleAlert`. Both siblings now read from one icon family.

This header change is structural (not a colour/elevation flip), so it is **not**
behind a feature flag — it's a chrome-system unification with no per-state visual
variant to ramp, and the old native-header path can't safely co-exist with the
in-screen header (that was the exact double-back-chevron bug `STACK_HEADER_HIDDEN`
exists to prevent). The flag-gated parts are the empty-state structure and the CTA
colour below.

### (2) Shared `NutritionDetailEmptyState` — structured, elevated, single-sourced

New `apps/mobile/components/nutrition/NutritionDetailEmptyState.tsx` replaces the
two screens' hand-rolled empty/error bodies with one component: an icon chip +
heading + subtitle + optional CTA.

- **`design_system_elevation` ON** → the body wraps in an elevated card
  (`useCardElevation` — soft `Elevation.cardSoft` shadow on light, tonal lift +
  hairline on dark) with the modern `Radius.xl` corner. The empty macro-detail is
  no longer a sea of whitespace — it's a designed surface. **OFF** → the legacy
  flat, card-less centred layout stays alive (the flag-off branch).
- The icon chip + heading/subtitle give the error and no-slot states real
  structure instead of a centred Ionicon that read as a crashed route.

Consumed by:
- `macro-detail` empty state (`Salad` icon, "Log a meal" CTA → Today).
- `meal-nutrition` no-slot state (`Salad`, "Go back") and load-error state
  (`CircleAlert`, "Go back"), each wrapped under a `PushScreenHeader` so back is
  always present now that the native header is gone.

### (3) CTAs → `PressableScale` + blue commit colour — `design_system_colours`

The shared empty-state CTA is a `PressableScale` (scale 1→0.97 + selection haptic),
replacing the opacity-only `Pressable`.

- **`design_system_colours` ON** → the CTA fills **blue** (`Accent.primary`), the
  single commit-action colour. **OFF** → the caller's legacy `ctaColorLegacy` fill
  (the saturated macro hue on macro-detail; `Accent.primary` on the meal-nutrition
  error states, which were already blue). The scale-press itself is a pure
  micro-interaction upgrade with no colour change, so it is not gated.

This fixes tell (4) — the saturated-macro CTA is gone in the flag-on path.

### (4) Tokenise the two hand-rolled meal-nutrition cards — `design_system_elevation`

The two resting `meal-nutrition` cards (macro-summary, "Vitamins, minerals & more")
used a hand-rolled `borderWidth: 1` hairline. They now consume `useCardElevation()`
(soft shadow / tonal lift / flag-off flat). These cards don't clip their children,
so the shadow rides the card directly (no outer wrapper needed).

## Parity

Both platforms updated in the same change.

- **Web** (`src/app/components/MacroDetailPanel.tsx`) mirrors the empty-state
  treatment: `design_system_elevation` ON → an iconified (`Salad`), elevated
  `rounded-xl` card with the soft ambient shadow; OFF → the legacy one-line empty
  state. The web surface is a **Dialog** (not a full push screen), so it has no
  separate header system to unify and no saturated-macro CTA to recolour — the
  dialog chrome provides the back/close affordance. The action-colour rule still
  holds: the web empty state renders no button, so there is nothing to mis-tint.
- **Intentional divergence (documented, not drift):** web meal-nutrition detail is
  the `MacroDetailPanel` dialog, not a standalone push screen — so the
  header-unification work (tells 1) is mobile-only by surface shape. The
  empty-state structure + action-colour rule are at parity.

## Tests

- `apps/mobile/tests/unit/nutritionDetailEmptyState.test.tsx` — the shared
  component: title/subtitle/CTA render, CTA fires `onPress`, CTA omitted with no
  label, **colour mapping** (legacy macro hue when `design_system_colours` off,
  blue when on), **structure** (elevated `Radius.xl` card when
  `design_system_elevation` on, flat when off).
- `apps/mobile/tests/unit/mealNutritionUnifiedHeader.test.tsx` — the
  missing-meal error path renders the shared `meal-nutrition-error` state (the old
  Ionicons layout is gone) with a "Go back" CTA wired to safe-back.
- `tests/unit/macroDetailPanel.test.tsx` — web empty state: flag-off one-line `<p>`,
  flag-on structured `rounded-xl` card, no saturated-macro button.
- `apps/mobile/tests/shims/lucide-react-native.cjs` — added `CircleAlert` to the
  explicit icon-name list so the shim resolves the new error glyph under test.

## Rollout

Both flags start OFF (old path live in the `else`). The header-system unification
ships unflagged (structural chrome fix, no variant to ramp). Solo-tester ramp the
two visual flags to 100% immediately after sim (mobile) + desktop/mobile-web (web)
visual sign-off, per the P0 flag-inventory plan. Remove the gates two weeks after
100% with no regression.
