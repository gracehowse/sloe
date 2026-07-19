/** Web transport for the ingredient-image lazy generate-on-miss endpoint —
 *  module-level + stable so `useIngredientTileImages`'s effect deps can safely
 *  exclude it. Extracted from `RecipeDetail.tsx` (ENG-1611 screen-budget
 *  shrink). */
export function postIngredientImage(body: { names: string[]; aliases?: Array<{ name: string; aliasKey: string }> }) {
  return fetch("/api/ingredient-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
}

/** ENG-1611 — stable empty source list for the text-rows path (hook deps
 *  safety: the flag-ON branch passes this so the tile-image hook never reads
 *  `ingredient_images` nor enqueues generation). */
export const EMPTY_TILE_SOURCES: never[] = [];
