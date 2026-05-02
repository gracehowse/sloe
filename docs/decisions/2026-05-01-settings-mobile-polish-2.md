# Settings mobile polish 2 — TestFlight Build 40

**Date:** 2026-05-01
**Owner:** product-engineer
**Status:** Resolved
**Branch:** `claude/settings-mobile-polish-2`

## Context

Five focused polish items sourced from TestFlight Build 40 feedback (Grace,
sole tester):

| Item | Source | Severity |
|------|--------|----------|
| Emoji magnifier in Settings search bar | TestFlight `ALCot9q4E4UFAtVubO6GlHo` ("Emoji here instead of lucid icon. Always use icons") | P0 |
| `PROMO CODE` ALL-CAPS micro-header | inconsistent with bundle SectionHeading pattern | P1 |
| `e.g. SUPPR_TEST_PREMIUM` placeholder leaks SKU | internal naming visible to every user | P0 |
| Searching "fast" returns "No matches for 'fast'" | TestFlight `AFHtAQRAWad1w8bDvSgZkUg` | P1 |
| "Tap meal for full nutrition doesn't show full nutrition" | tester perception that the meal-detail screen hides Sugar / Sodium | P0 |

## Decision

Ship a focused, scoped polish PR. No structural rewrites; no cross-section
regressions. Every change carries a comment that anchors it to the feedback
ID + build it landed in.

### 1. Lucide Search replaces the emoji
`apps/mobile/app/(tabs)/settings.tsx` now imports `Search` from
`lucide-react-native` and renders `<Search size={16} color={colors.textTertiary}
strokeWidth={1.75} />` where the bare emoji Text node previously sat. Matches
the rest of Settings (every other icon is lucide). `accessibilityElementsHidden`
keeps it out of the a11y tree — the input itself owns the
`accessibilityLabel="Search settings"`.

### 2. Promo code micro-header drops ALL CAPS
`PROMO CODE` (12/700, letterSpacing 0.6) → `Promo code` (14/700,
letterSpacing -0.1, sentence case). Aligns with the bundle's
`SectionHeading` visual pattern. Surrounding helper text and the input
chrome are unchanged.

### 3. Promo placeholder stops leaking the SKU
`e.g. SUPPR_TEST_PREMIUM` → `Enter code`. The helper Text already
explains what the user is meant to do ("Enter your code exactly as
provided…"). Internal SKU strings (e.g. `SUPPR_TEST_PREMIUM`) must not
surface to the user-facing UI.

### 4. Fasting findable
Two changes in `Body & activity`:

- The `matchesSearch` keyword list now contains `"Fasting"`, `"fast"`,
  `"intermittent"`, `"16:8"`, `"eating window"`. Typing any of these in
  the Settings search filters the section in (case-insensitive substring
  match against the keyword list).
- A new `settings-fasting-row` row pushes `/fasting` (the existing
  destination screen — owns window picker + session start/stop). Sub
  copy: "Pick a window (e.g. 16:8) and start a fast. Active fasts
  surface on Today."

The fasting screen and persistence (`profiles.fasting_window` /
`fasting_sessions`) already exist; this change closes the discoverability
gap, not the feature gap.

### 5. Tap meal for full nutrition — comprehensiveness lift
Two changes:

- `apps/mobile/components/today/TodayMealsSection.tsx`: hint copy
  `"X items · tap an item for nutrition"` →
  `"X items · tap for full nutrition"`. Signals what the
  meal-nutrition screen shows (macros + extras + micros + source).
- `apps/mobile/app/meal-nutrition.tsx`: hoist Sugar and Sodium from the
  buried "Vitamins, minerals & more" panel up to the always-visible
  extras strip alongside Fiber and Water. Same source of truth
  (`meal.micros.sugarG` / `meal.micros.sodiumMg`) — the micros table
  below still renders the full set.

## Web parity

| Item | Mobile | Web | Notes |
|------|--------|-----|-------|
| 1 (lucide Search) | done | n/a | Web Settings has no search bar — feature is mobile-only by design. |
| 2 (promo header) | done | n/a | Web Settings has no promo redemption row in the same shape — Stripe handles redemption codes via the checkout flow. |
| 3 (placeholder) | done | n/a | Same reason as 2. |
| 4 (fasting findable) | done | n/a | Web Settings has no search bar to "no-match" against. The fasting feature does exist on web (NutritionTracker reads `fasting_sessions`). |
| 5 (extras hoist + hint) | done | DEFERRED | Web meal rows are non-clickable today; tapping a web meal row does not open a meal-nutrition page. Adding that route is out of scope for this polish. Logged as an existing gap; sync-enforcer carve-out. |

`sync-enforcer` carve-out: items 1–3 are mobile-only by feature
asymmetry (web has no Settings search bar / no in-product promo row in
the same shape). Item 4 follows the same path. Item 5's hint-copy
change is mobile-only because web does not render that hint. The
extras-hoist on the meal-nutrition screen is mobile-only because web
has no equivalent screen yet.

## Tests

- `apps/mobile/tests/unit/settingsSearchPolish2.test.ts` (new) —
  - "Settings polish-2 (TestFlight Build 40)" — asserts the lucide
    swap, the placeholder change, the sentence-case Promo code header,
    the fasting keyword index, and the `settings-fasting-row`.
  - "Settings search keyword index — fasting" — case-insensitive
    matcher contract against the Body & activity keyword list. Covers
    `fast`, `Fast`, `FAST`, `fasting`, `Fasting`, `intermittent`,
    `Intermittent fasting`, `16:8`. Negative case: `kombucha` does NOT match.
- `apps/mobile/tests/unit/mealNutritionExtras.test.ts` (new) —
  - Asserts Sugar and Sodium render in the extras strip in the order
    Fiber → Sugar → Sodium → Water.
  - Asserts the helper functions clamp non-finite / negative / null
    inputs to 0 (no NaN reaches the UI).
  - Asserts the Today hint copy is "tap for full nutrition" and that
    the prior wording is gone.

The existing `apps/mobile/tests/unit/settingsSearch.test.ts` continues
to assert the wave-2 search contract; this PR does not alter it.

## Out of scope

- Web meal-nutrition page (deferred — existing gap, not introduced by
  this PR).
- Per-100g view on the meal-nutrition screen (would require gram-weight
  at serving; not always available on logged entries — would need a
  data-model change).
- Confidence percentage as a visible number (the screen already
  surfaces source provenance via the SourceDot + meta line; explicit
  numeric confidence is a separate trust-posture decision).
