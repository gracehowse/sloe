# ENG-1304 — Onboarding refugee capture (recipe import + MFP CSV)

**Date:** 2026-07-03  
**Status:** Shipped  
**Linear:** ENG-1304

## Problem

The July 1 full-product sweep found the lead viral bet (recipe import) and
MFP-refugee CSV adapters were invisible during first-run:

- `data-bridges` recipe card told users to "try after setup" — no in-flow import.
- Legacy `import.tsx` (off the linear path) faked a parse with a hardcoded recipe.
- `app-choice` promised history import near the end, but only the CSV card delivered.

## Decision

Wire **real** recipe import into the `data-bridges` step on web + mobile:

1. New `OnboardingRecipeImportCard` calls `POST /api/recipe-import`, persists via
   `saveImportedRecipe` (save-first), sets `dataBridgeChosen: "recipe"`, and shows
   honest success UI from the parsed recipe (not a demo stub).
2. Shared hook `useOnboardingRecipeImport` owns the idle → importing → success/error
   state machine; sample URL is `cookieandkate.com/best-lentil-soup-recipe/` (seed list).
3. Card order: when `app-choice` names an importable app → **CSV first, recipe second**;
   otherwise → **recipe first, CSV last** (MFP history vs viral hook).

MFP CSV import was already on `data-bridges`; this change surfaces recipe import to
match the app-choice promise and closes the fake-demo gap.

## Validation

- `tests/unit/onboardingRecipeImport.test.ts`
- `tests/unit/onboardingDataBridgesWeb.test.tsx` (structural)
- Web + mobile parity on card order and affordances
