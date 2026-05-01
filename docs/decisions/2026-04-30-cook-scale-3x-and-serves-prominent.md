# Cook scale: add 3x preset + surface "Serves N" prominently

**Date:** 2026-04-30
**Status:** Resolved
**Area:** Cook flow / recipe scaling
**Round:** User-sentiment audit, round 4

## Problem

Mealime's locked 2/4/6 servings was a top community complaint surfaced
by the round-4 user-sentiment audit. PR #9 already shipped scale presets
0.5/1/1.5/2/4 — solving the binary 2/4/6 lock — but two gaps remained:

1. **No 3x preset.** A 2-serving recipe scaled to a 6-serving household
   pan via "next nearest" 4x, which over-cooks. 3x is the cleanest path.
2. **"Serves N" was hidden** when scale = 1. The cook-scale caption read
   "Original recipe" — which is true but doesn't tell a solo cook
   they're cooking for 1, or a household cook they're cooking for 2 or
   4. The recipe yield was effectively invisible at the default scale.

## Decision

1. Add **3x** to `COOK_SCALE_PRESETS`. The list is now
   `[0.5, 1, 1.5, 2, 3, 4]` — six pills in ascending order, with 1
   always present as the unscaled default.
2. Update `cookScaleCaption(scale, baseServings)` to render
   **"Serves N"** at scale = 1 when `baseServings` is known. Falls back
   to "Original recipe" when the yield is unknown so the caption never
   misrepresents the dish. Singular form for `Serves 1`.
3. Mobile-side: thread a new optional `servings` query param through to
   `cook.tsx` and pass it to `cookScaleCaption`. Web's `CookMode.tsx`
   already passed `recipe.servings || null`, so it picks up the new
   "Serves N" copy automatically.

## Files changed

- `src/lib/nutrition/recipeScale.ts` — extended preset list; reworked
  `cookScaleCaption` for the "Serves N" output at scale = 1.
- `apps/mobile/app/cook.tsx` — accept `servings` route param; parse
  safely; pass to `cookScaleCaption` instead of `null`.
- `tests/unit/recipeScale.test.ts` — pinned preset list to 6 entries;
  added "Serves N" / "Serves 1" / "Serves 2" coverage; added the
  3x of 2 = 6 servings expectation.

## Parity

- Web: `src/app/components/CookMode.tsx` already passes the recipe
  yield to `cookScaleCaption`, so the "Serves N" copy lands automatically.
- Mobile: route param wiring is new. Callers of `/cook` that have the
  yield available should pass `servings={recipe.servings}` in the
  navigation. Callers with unknown yield will continue to see
  "Original recipe" — the caption never invents.

## What this does NOT change

- The scaling math. `scaleAmountText` is unchanged; 3x is just a new
  preset value passed through the same pipeline.
- The DB constraint on `recipe_cook_history.scale_factor` — already
  allows 0..99 so 3 fits.
- The persisted scale storage. `cookScaleStorageKey` keys on
  `(userId, recipeId)` and stores the chosen preset; 3 is now a valid
  value but legacy 0.5/1/1.5/2/4 keys keep working.

## Risks / follow-ups

- Cook navigation calls that don't currently pass the yield will see
  "Original recipe" instead of "Serves N". Audit pass needed to thread
  the param through the remaining call sites (most live on the recipe
  detail screen and inline cook overlay; both already have the yield in
  scope).
- A 5x preset is NOT added — most recipes hit awkward halfway numbers
  (e.g. "1/3 of an egg") above 4x. If demand surfaces, add it then.
