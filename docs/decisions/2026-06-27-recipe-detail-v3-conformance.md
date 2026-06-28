# Recipe-detail v3 prototype-conformance (ENG-1247)

**Date:** 2026-06-27
**Area:** Recipes tab / recipe detail (web + mobile)
**Status:** Resolved (shipped behind a default-OFF flag, pending Grace's SEE-validation)

## Context

ENG-1247 is the Sloe v3 full prototype-conformance pass. The recipe-detail
surface was brought to the prototype (`docs/ux/redesign/v3/Sloe-App.html`
`RecipeDetail`, hero overlay L4336–4341, standfirst L4353, sticky CTA
L4418–4421) on **both** platforms, gated behind the new default-OFF flag
`recipe_detail_v3_conformance` (registered in
`apps/mobile/lib/analytics.ts` `KNOWN_DEFAULT_OFF_FLAGS` + web
`src/lib/analytics/track.ts`). The old path stays alive in the `else`.

## What shipped (flag-ON)

1. **Hero title overlay** — when the recipe has a real photo, the kicker
   (`From your cookbook` when saved, else `Fits your day`) + serif H1 + a
   clock·flame·serves meta row sit on the hero under a bottom veil. When there
   is **no photo**, the tinted placeholder + title-below fallback is kept
   unchanged (the overlay is never forced onto the placeholder). The duplicate
   body H1 is hidden when the overlay is active.
2. **Editorial standfirst** — a serif headnote under the hero (prototype
   `rd-standfirst`), using the recipe description with a protein-anchored
   graceful fallback when absent.
3. **Consolidated sticky CTA bar** — one bar: YIELD serving stepper · Cook Mode
   (outline secondary) · Log (filled primary, dominant). Log is the single
   filled slab (one-filled-CTA rule). Log moved out of the action-pill row,
   which collapses to the owner-only Edit pill (renders nothing for non-owners).
   The mid-body "Servings to view" card is hidden when the bar is on so there is
   no duplicate stepper.
4. **Web Log gap-fill** — web previously had **no real Log**: the "Log" button
   fired a fake `toast.success("Marked as made!")`. The v3 sticky-bar Log is now
   a REAL journal write routed through the shared planned-meal log path
   (`fetchPlannedMealMicros` coercion guard → `addLoggedMealForDate(..., "recipe")`
   with `source: "Recipe"` + the recipe FK + the shared
   `journalSlotFromMealTypes` slot), identical to the LogSheet Library pick and
   the planner row → Log. A recipe with kcal but unresolved P/C/F is refused
   with the Verify prompt — never logs a fabricated split.
5. **Serif macro numerals** — already satisfied: both `RecipeMacroStrip.tsx`
   (mobile, `FontFamily.serifRegular` @ 24px) and the web macro strip
   (`var(--font-headline)` @ 24px) already render the kcal/P/C/F numerals in the
   v3 serif. No code change needed; pinned by tests.

## Carve-outs / intentional non-changes

- **"Fits your day" verdict banner — NOT touched.** It keeps its tri-state
  SOLID treatment per
  `docs/decisions/2026-06-13-fits-your-day-verdict-banner.md` (the prototype's
  chip lacks the over-budget state — ui-critic ruling). The prototype's coloured
  inline "Fits your day · ≈N%" line is therefore intentionally dropped in favour
  of the existing banner.
- **Kicker has no cuisine.** The prototype's kicker can read the cuisine; the
  recipe pipeline has **no `cuisine` field**, so we do not fabricate one — the
  honest `From your cookbook` / `Fits your day` pair is used instead.

## Allergen chip — deferred (NOT built; needs a separate ticket)

The prototype's `rd-allergen` pill renders a free-from claim ("No
gluten-containing ingredients"). We did **not** build a new per-allergen chip:

- The recipe pipeline only produces a **"Contains X"** positive list
  (`recipe.allergens`), not reliable per-allergen **free-from** data.
- Regulated free-from claims (e.g. "gluten-free") are legally forbidden as
  labels on a coeliac-sensitive surface (ENG-748, EU/UK Reg 828/2014).
- The honest, legally-safe equivalent already ships: the gluten classifier
  `TrustChip` + its mandatory disclaimer, and the regulated-allergen "Contains"
  callout from `recipe.allergens`.

Building a "No X" free-from chip would require either faked data or a forbidden
claim, so it is deferred. **Action:** file a separate Linear ticket if a
free-from allergen surface is wanted, scoped to first sourcing reliable
per-allergen free-from data.

## Tests

- Web: `tests/unit/recipeDetailV3Conformance.test.ts` (13 tests).
- Mobile: `apps/mobile/tests/unit/recipeDetailV3Conformance.test.ts` (12 tests).
- Existing `tests/unit/recipeDetailFigmaReskin.test.ts` updated (indentation-
  robust body-title slice).

## Parity

Web and mobile are in lockstep: same flag name, same hero overlay /
standfirst / sticky-bar structure, same Log behaviour (shared coercion guard +
slot helper + canonical `Recipe` source). The only platform-shaped difference is
native idiom (RN `SupprButton`/`PressableScale` vs web buttons with
hover/focus-visible/active).
