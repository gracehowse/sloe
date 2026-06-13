# "Fits your day" verdict — confident banner, not a faint pill (ENG-1085)

**Date:** 2026-06-13
**Area:** Recipes tab / recipe detail (web + mobile)
**Status:** Resolved
**Flag:** `fit_verdict_banner_v1` (in `REDESIGN_DEFAULT_ON` on both platforms; PostHog row survives only as a kill switch via `isFeatureDisabled`)

## Context

A senior-designer read of Sloe (2026-06-13) found the identity is good but the
**differentiator is too quiet**. The "Fits your day" verdict — the one thing
that makes Suppr a *goals-aware* recipe app rather than another recipe saver —
rendered as a small, left-aligned **10%-wash sage pill** tucked under the
attribution line. It read as metadata, not as the screen's reason to exist.

The product positioning ("I love cooking but I also have fitness goals →
fit the foods you love into your plan") lives or dies on this moment. It
should be the loudest informational element on the recipe detail.

## Decision

Render the verdict as a **confident full-width SOLID banner**:

- **Fill:** the tone's `*Solid` token — sage (`successSolid`) when the recipe
  fits ≈ half the day or less, amber (`warningSolid`) for over-half, red
  (`destructiveSolid`) for over-a-full-day. White text on all three (AA-safe).
- **Layout:** full-bleed (`alignSelf: stretch` / `w-full`), `Radius.xl`,
  white check glyph when it fits, lead verb ("Fits your day") loud, the
  trailing "≈ N% of your day" subordinated (right-aligned, white @ 82%).
- **Haptic (mobile):** a one-shot success notification when the recipe fits —
  the small "felt yes" that builds the import-then-check habit.
- It is a **verdict surface, not a CTA** (`accessibilityRole="text"`, no tap
  target), so it does not violate the one-filled-CTA-per-screen rule — the
  aubergine **Log** button remains the single action, differentiated by colour
  (sage verdict vs aubergine action) and form.

The verdict logic is unchanged — still the shared
`computeFitsYourDayVerdict` in `src/lib/recipe/recipeDetailLayout.ts`. Only the
presentation changed.

### Why the flag pattern (per CLAUDE.md)

Visual change → gated. The new banner is the default-on path; the legacy
10%-wash pill stays alive in the `else` as the kill switch. Once the flag has
held 100% for two weeks with no regression, the legacy pill can be removed in a
cleanup PR.

### Scheme-constant tokens (web)

The `*Solid` CSS vars lighten in dark mode (e.g. `--success-solid` →
`#83A57E`), which would fail AA against white text. New **scheme-constant**
tokens — `--verdict-banner-success/-warning/-destructive` — are defined only in
`:root` (never overridden in `.dark`) so the white text stays AA in both
schemes. Mobile `*Solid` tokens are already scheme-constant, so the mobile
banner uses them directly.

## Files

- `apps/mobile/components/recipe/RecipeTitleBlock.tsx` — banner + legacy pill
- `src/app/components/RecipeDetail.tsx` — banner + legacy pill (web parity)
- `apps/mobile/lib/analytics.ts`, `src/lib/analytics/track.ts` — flag in
  `REDESIGN_DEFAULT_ON`
- `src/styles/theme.css` — `--verdict-banner-*` scheme-constant tokens
- Tests: `tests/unit/recipeDetailLayoutWeb.test.tsx`,
  `apps/mobile/tests/unit/recipeDetailV3SourcePins.test.ts`

## Verified

Rendered on the iOS simulator (recipe detail, Classic Greek Salad ≈ 30% → sage
banner) and the web app at `--vp mobile` (same surface, identical treatment).
Both platforms: confident sage banner, white check + label, "≈ 30%" subordinate.
