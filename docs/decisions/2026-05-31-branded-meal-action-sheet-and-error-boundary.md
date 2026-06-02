# Branded meal action sheet + brand-language error boundary (mobile)

**Date:** 2026-05-31
**Status:** Resolved (mobile implemented; flag-gated OFF pending sim sign-off)
**Area:** Today / Logging / Brand consistency
**Flag:** `redesign_branded_sheets` (visual/structural → flag-gated per CLAUDE.md)
**Issue:** [ENG-799](https://linear.app/suppr/issue/ENG-799)
**Initiative:** Redesign — Design Direction 2026
**Direction:** [`2026-05-31-design-director-review-and-direction.md`](2026-05-31-design-director-review-and-direction.md)
**Prototype:** `docs/prototypes/2026-05-31-design-direction/surface-meal-actionsheet.html`

## The gap

The design-director review flagged two surfaces that break the otherwise
fully-custom cream brand world at high-impact moments:

1. **Meal long-press** on a logged Today row fired a raw `Alert.alert`
   (`ActionSheetIOS`-grade system chrome — grey stack, system font,
   system-blue / system-red). The single biggest stock-component tell in
   the app, and it cannot render a thumbnail or macro preview.
2. **The root error boundary** hardcoded off-brand hex strings
   (`#0a0a0f`, `#e4e4e8`, `#94a3b8`, `#64748b`) and carried no brand mark —
   the most off-brand moment in the product (a crash) read as a borrowed
   OS error screen.

## The decision

**(a) Branded meal action sheet.** Long-press now opens a custom cream
bottom sheet speaking the same grammar as `SavedMealPortionSheet` (cream
`colors.background` surface, grabber, `Elevation.sheet`, blue commit
accent, `Accent.destructive` for Delete). It shows what the native sheet
physically cannot: the meal thumbnail, name, and a canonical
`kcal · P/C/F` macro preview (built via `formatMacroTrailer`). Four action
rows — Edit entry (blue `PencilLine`), Copy to another day (`CalendarPlus`),
Share meal (`Share2`), Delete entry (red `Trash2`) — each elevated, with a
press-scale response and a chevron on the non-destructive rows. One quiet
`SupprMark` sits in the sheet corner (ENG-797).

**(b) Brand-language error boundary.** The recovery UI is rebuilt on
`Colors.dark.*` + `Accent.*` tokens (no hardcoded hex), adds the canonical
ring brand mark, the `Type.*` ladder, and the blue `Accent.primary` CTA.

## Implementation

Both changes live in their own files only (file-lane discipline):
`apps/mobile/components/today/TodayMealsSection.tsx` and
`apps/mobile/components/ui/RootErrorBoundary.tsx`.

- **Action sheet** — `MealActionSheet` is co-located in `TodayMealsSection.tsx`
  (kept in-file rather than a new module to respect the change lane). The
  long-press handler branches on `isFeatureEnabled("redesign_branded_sheets")`:
  flag ON → `Haptics.selectionAsync()` + `setActionSheetMeal(m)` opens the
  branded sheet; flag OFF → the prior `Alert.alert` fires **verbatim**. Each
  branded action closes the sheet first, then defers to the existing host
  handler (`onLongPressEdit` / `onRequestCopyMeal` / share / `onDeleteMeal`) —
  closing first avoids modal-over-modal stacking on iOS when Edit opens the
  edit-entry sheet. The `Share meal` logic (`buildMealShareText` +
  `meal_share_invoked` analytics) is extracted to one `shareMeal` helper so
  the native-Alert path and the branded path stay byte-identical on share.

- **Error boundary** — `redesign_branded_sheets` (read inside a `try/catch`
  so a cold/throwing flag client can never re-crash the recovery UI) selects
  `renderBranded()` vs the unchanged `renderLegacy()`. The boundary is a
  class component **above** the theme provider, so it cannot use
  `useThemeColors()` or the hook-dependent `SupprMark`; it references
  `Colors.dark.*` directly and renders a self-contained inline ring mark.

## Why one flag for both surfaces

`redesign_branded_sheets` gates both because they are the same brand
intent — "kill the borrowed-OS-chrome moments" — and Grace ramps them
together. The error boundary's flag-off path is the existing hardcoded-hex
layout (kept alive verbatim), so the gate is a clean either/or with no
behaviour change when off.

## Tests

- `apps/mobile/tests/unit/mealActionSheetBranded.test.tsx` — 7 cases:
  flag-off long-press does NOT open the sheet; flag-on opens it with the
  four rows + cancel; header shows name + `kcal·P/C/F` + the Delete-row
  kcal sublabel; Edit closes + calls `onLongPressEdit(meal)`; Copy calls
  `onRequestCopyMeal(id)`; Delete calls `onDeleteMeal(id)`; Cancel closes
  with no host call.
- `apps/mobile/tests/unit/rootErrorBoundaryBranded.test.tsx` — 5 cases:
  flag-off legacy layout; flag-on branded layout + mark + CTA; error
  captured exactly once; "Try again" recovers; a throwing flag client
  falls back to legacy without re-crashing.
- Shim: added `CalendarPlus` to `apps/mobile/tests/shims/lucide-react-native.cjs`
  (named ESM imports need an explicit export; the Proxy fallback only covers
  dynamic access).

All 12 green. Mobile typecheck clean on both changed files (the unrelated
`TodayEditMealModal.tsx` / `SavedMealPortionSheet.tsx` errors are from the
in-flight ENG-783/784 lane, not this change).

## Parity

This is a **mobile-only** surface in this issue: the raw iOS Alert and the
RN error boundary are mobile constructs with no 1:1 web equivalent. The web
meal-action affordance (`src/app/components/suppr/today-meals-section.tsx`)
already uses `--primary` for edit and `--destructive` for delete, so the
colour grammar matches; a web visual pass on the action surface stays with
the ui-product-designer per the implementation plan (P1 issue, web analog
note). No new cross-platform divergence is introduced — the brand colours,
icons, and destructive role match the web surface.

## Rollout

Flag OFF in PostHog. Grace validates the sheet + a forced crash in the iOS
sim; once confirmed, ramp via the PostHog dashboard. After two weeks at
100% with no regression, the gate can be removed in a follow-up cleanup PR.
