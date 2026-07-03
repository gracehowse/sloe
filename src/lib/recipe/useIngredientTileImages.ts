/**
 * `useIngredientTileImages` — shared hook that hydrates the ingredient-tile
 * `name_key → image_url` map for a recipe's ingredients (Sloe image system
 * §4, 2026-06-08; ENG-1276 alias fallback).
 *
 * Extracted from `RecipeDetail.tsx` (web) + `recipe/[id].tsx` (mobile) so the
 * hydration + lazy generate-on-miss + alias-fallback behaviour lives once and
 * can't drift, and the screen files stay thin (screen-budget ratchet). Only
 * the `post` transport differs (same-origin fetch on web, `authedFetch` on
 * mobile) — passed in by the caller.
 *
 * Behaviour:
 *   - Keyed on the joined names + alias signature, so it only re-fetches when
 *     the ingredient set OR a persisted alias key actually changes.
 *   - For a text-key MISS whose ingredient carries a trusted `matchedAliasKey`,
 *     resolves the tile the matched food already owns (ENG-1276 fallback).
 *   - Fires lazy generate-on-miss for still-missing tiles (fire-and-forget),
 *     forwarding the alias pairs so the endpoint records them once ready.
 *   - Degrades to an empty map (calm placeholders) on any error; never throws.
 *
 * `post` MUST NOT be recreated per render in a way that matters — the effect
 * deps intentionally exclude it (it is a stable transport); pass a module-level
 * or `useCallback`-stable function.
 */

import { useEffect, useState } from "react";
import { fetchIngredientImages } from "./ingredientImages";
import {
  enqueueIngredientImages,
  type IngredientImagePost,
} from "./enqueueIngredientImages";
import {
  buildIngredientAliasInputs,
  ingredientAliasSignature,
  type IngredientAliasSource,
} from "./ingredientAliasInputs";

export function useIngredientTileImages(
  supabase: unknown,
  ingredients: ReadonlyArray<IngredientAliasSource>,
  post: IngredientImagePost,
): ReadonlyMap<string, string> {
  const [imageMap, setImageMap] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );

  const namesSig = ingredients.map((i) => i.name).join("");
  const aliasSig = ingredientAliasSignature(ingredients);

  useEffect(() => {
    const names = ingredients.map((i) => i.name);
    if (names.length === 0) {
      setImageMap(new Map());
      return;
    }
    const { aliasKeyByCanonicalKey, aliasPayload } = buildIngredientAliasInputs(ingredients);
    let cancelled = false;
    void (async () => {
      const { map, missingKeys } = await fetchIngredientImages(supabase, names, {
        aliasKeyByCanonicalKey,
      });
      if (cancelled) return;
      setImageMap(map);
      if (missingKeys.length > 0) {
        enqueueIngredientImages(names, post, aliasPayload);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesSig, aliasSig]);

  return imageMap;
}
