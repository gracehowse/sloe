# Cook-mode ingredient checklist (ENG-946)

**Date:** 2026-06-20  
**Area:** Recipes / Cook mode  
**Status:** Resolved  
**Linear:** ENG-946  
**Flag:** `cook_ingredient_checklist_v1` (default-OFF)

## Context

Recipe apps like NYT Cooking and Cook Mode+ let cooks cross ingredients off as they
shop or cook. Suppr's ingredient list was read-only — easy to lose your place
("did I already add the salt?").

## Decision

Add **tap-to-check ingredient rows** with calm success checkmarks and gentle
strike-through, stored **in memory per recipe for the app session** (not persisted
across restarts). Shared between recipe detail and cook mode so checks carry over
when you open cook mode mid-recipe.

- Shared store: `src/lib/nutrition/cookIngredientChecklist.ts` + React hook
  `useCookIngredientChecklist`.
- **Recipe detail (Ingredients):** checklist list above the thumbnail grid when
  flag is ON.
- **Cook mode:** optional **"Gather your ingredients"** mise en place screen before
  step 1; web cook sidebar uses the shared store when flag is ON (legacy local
  state when flag is OFF — byte-identical revert).

## Flag posture

Default-OFF. Flag-OFF → no checklist on recipe detail, no mise screen on mobile,
web cook sidebar keeps its pre-ENG-946 local-only check state.

## Analytics

`cook_ingredient_checked` — `{ recipeId, index, checked, surface, platform }`.

## Parity

Same session store and checklist UX on web + mobile. Web cook sidebar existed
pre-ENG-946; flag-ON unifies it with recipe detail via the shared store.
