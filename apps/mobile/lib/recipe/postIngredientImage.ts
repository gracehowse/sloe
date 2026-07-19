import { authedFetch } from "@/lib/authedFetch";
import { getSupprApiBase } from "@/lib/supprWeb";

/** Mobile transport for the ingredient-image lazy generate-on-miss endpoint —
 *  module-level + stable so `useIngredientTileImages`'s effect deps can safely
 *  exclude it. No-ops (resolves) when the API base is unset. Extracted from
 *  `app/recipe/[id].tsx` (ENG-1611 screen-budget shrink). */
export async function postIngredientImage(body: {
  names: string[];
  aliases?: Array<{ name: string; aliasKey: string }>;
}): Promise<unknown> {
  const apiBase = getSupprApiBase();
  if (!apiBase) return undefined;
  return authedFetch(`${apiBase}/api/ingredient-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** ENG-1611 — stable empty alias-source list for the text-rows path (hook
 *  deps safety: the flag-ON branch passes this so the tile-image hook never
 *  reads `ingredient_images` nor enqueues generation). */
export const EMPTY_ALIAS_SOURCES: { name: string; matchedAliasKey: string | null }[] = [];
