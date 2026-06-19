# Cook mode — "For this step" inline ingredient chips (ENG-944)

**Status:** Resolved (shipped behind a default-OFF flag, awaiting on-device visual validation before ramp)
**Date:** 2026-06-19
**Area:** Cook mode (mobile + web)
**Trigger:** The #1 cook-mode complaint — on step 4 you scroll back up to
re-check "how much butter again?". We surface the relevant ingredients
(amount + name) inline beneath each instruction, in cook mode.

## What we changed

A calm "For this step" chip row renders beneath each cook-mode
instruction, listing the recipe ingredients that step references. Mobile
is the primary surface; web is parity.

- **Caption:** a quiet uppercase tracked "For this step" label, matching
  the existing `lastTimeLabel` / "Last time" treatment.
- **Chips:** calm cream cards (mobile `colors.card` + hairline border;
  web `bg-muted/60` + border) with measured **serif** amount+name text —
  no loud accent fills, in the Julienne editorial register.
- **Amounts respect the active scale.** Chip quantities run through the
  shared `scaleAmountText` (via `stepIngredientChipLabel`) so a "2 tbsp
  butter" line reads "1 tbsp butter" at 0.5x — exactly like the step text.

### No schema change — a pure matcher

Per the ticket, there is **no migration**. The recipe model stores
instructions as free-text strings, not as structured (step → ingredient)
links. We infer the link at render time with a pure, well-tested matcher:

`ingredientsForStep(stepText, ingredients)` in
`src/lib/recipe-ingredients/stepIngredients.ts` (shared; mobile imports it
via `@suppr/shared/recipe-ingredients/stepIngredients`).

Matching contract (conservative — when uncertain, OMIT; never fabricate a
match, per the project nutrition rule):

- Case-insensitive.
- **Token / word-boundary matching, never substring** — "butter" never
  matches inside "buttermilk" or "butterfly the chicken".
- Simple plural folding so "tomatoes" in the step matches a "tomato"
  ingredient (and vice versa). Suffix stripping, not a stemmer; guards
  `-ss`/`-us` (glass, hummus) from over-folding.
- **Multi-word names require every content word present** — a step that
  says only "oil" does not match "olive oil" unless "olive" is also there.
- Descriptor/stopwords ("of", "the", "fresh", "chopped", "to taste") are
  dropped from the ingredient name before matching, so "freshly chopped
  garlic" still matches a step that just says "garlic". A name that
  reduces to only stopwords ("to taste") never matches.
- A step with no ingredient reference yields `[]` → the chip row renders
  nothing (no empty label).

The matcher + the `stepIngredientChipLabel` / `cookStepIngredientChips`
helpers are exhaustively unit-tested in
`tests/unit/stepIngredients.test.ts` (positive matches, plurals, multi-word
names, false-positive guards, empty/weird/malicious inputs, flag gate) and
mirrored for mobile parity + route-param parsing in
`apps/mobile/tests/unit/cookStepIngredients.test.ts`.

### Where it renders

- **Web:** `src/app/components/CookMode.tsx` — the chip row sits beneath
  the step text. Web already had the structured `ingredients` in props, so
  no plumbing change was needed.
- **Mobile (live surface):** the inline cook overlay in
  `apps/mobile/app/recipe/[id].tsx` — the recipe screen already has the
  resolved display ingredients (`ingredientsForIngredientsTab`) in scope.
- **Mobile (standalone `/cook` route):** `apps/mobile/app/cook.tsx` now
  accepts an optional `ingredients` route param (a JSON
  `{ name, amount, unit }[]`) so the matcher has data when that route is
  used. The param is fail-safe parsed (absent / malformed → no chips) and
  carries only the three fields the matcher needs — no macros / PII in the
  deep link. NOTE: this standalone route currently has no live caller (the
  inline overlay is the active cook surface); the param is consumed so the
  route is symmetric and ready the moment a `/cook` navigation is wired.

## Feature flag

Gated behind **`cook_step_ingredients_v1`**, **default-OFF** on BOTH
platforms. It is deliberately NOT in either `REDESIGN_DEFAULT_ON` set, so
with no PostHog rollout it resolves to `false` and the cook surfaces are
byte-identical to today (no chips, no visible route-param behaviour). The
flag is documented as a known default-OFF flag next to `REDESIGN_DEFAULT_ON`
in `src/lib/analytics/track.ts` and `apps/mobile/lib/analytics.ts`. Ramp
via PostHog once visually validated on device.

## Pending pre-ramp step

On-device (iOS simulator) visual validation of the mobile chip row could
not be done in the implementation environment (no simulator). The flag
keeps the feature dark, so this is safe to land — but the mobile capture +
visual sign-off is a required step before flipping `cook_step_ingredients_v1`
on.

## Files

- `src/lib/recipe-ingredients/stepIngredients.ts` — pure matcher + label +
  chip helpers (NEW)
- `tests/unit/stepIngredients.test.ts` — matcher/label/gate unit tests (NEW)
- `apps/mobile/tests/unit/cookStepIngredients.test.ts` — mobile parity +
  route-param parse tests (NEW)
- `src/app/components/CookMode.tsx` — web chip row
- `apps/mobile/app/recipe/[id].tsx` — mobile inline-overlay chip row
- `apps/mobile/app/cook.tsx` — standalone route: `ingredients` param +
  chip row
- `src/lib/analytics/track.ts`, `apps/mobile/lib/analytics.ts` — flag doc
