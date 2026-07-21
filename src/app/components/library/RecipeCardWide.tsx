"use client";

import * as React from "react";
import { RecipeHeroFallback } from "../suppr/RecipeHeroFallback";
import { recipeUnderlayColor } from "../../../lib/recipe/recipeHeroFallback";
import { useFallbackScheme } from "../../../lib/theme/useFallbackScheme";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import { totalRecipeDurationMin } from "../../../lib/recipes/totalDuration";

import type { RecipeCard } from "@/types/recipe";

/**
 * RecipeCardWide — the Sloe v3 Cookbook editorial-shelf card.
 *
 * WEB parity twin of `apps/mobile/components/library/RecipeCardWide.tsx`
 * (prototype `rcard--wide` ~L4176, `.rcard--wide{width:188px}` /
 * `.rcard-img{height:128px}`): a fixed 188px card with a 128px photo (or the deterministic
 * RecipeHeroFallback tint + glyph when none — honest imagery, ENG-1287), the recipe name (2 lines), and a
 * "{kcal} kcal · {protein}g protein · {time} min" meta line — or "Nutrition pending · {time} min"
 * when calories are 0. Used inside {@link EditorialShelf} (host-gated on the
 * category filter; the `sloe_v3_editorial_shelves` flag that gated this was
 * collapsed as always-on in ENG-1356).
 */
export interface RecipeCardWideProps {
  recipe: RecipeCard;
  onPress: () => void;
}

export function RecipeCardWide({ recipe, onPress }: RecipeCardWideProps) {
  const [broken, setBroken] = React.useState(false);
  const fallbackScheme = useFallbackScheme(); // ENG-1528 — dark ramp underlay on dark cards
  const mediaPalette = isFeatureEnabled("recipe_sparse_media_v1") ? "plum-duotone" : "legacy-cuisine";
  const image = recipe.image?.trim() ?? "";
  const showImage = image.length > 0 && !broken;
  // ENG-1617 — one shared total (prep + cook) selector, not a local sum.
  const mins = totalRecipeDurationMin(recipe.prepTimeMin, recipe.cookTimeMin);
  const hasKcal = recipe.calories > 0;
  const meta = [
    hasKcal
      ? `${Math.round(recipe.calories)} kcal · ${Math.round(recipe.protein)}g protein`
      : "Nutrition pending",
    mins != null ? `${mins} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${recipe.title}, ${meta}`}
      className="group w-[188px] shrink-0 snap-start rounded-[var(--radius-card-lg)] text-left transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]"
    >
      {/* Borderless recipe-card grammar (Sloe v3, ratified 2026-06-23): only the
          photo is a rounded 24px tile (`--radius-card-lg`); the card carries no
          border or fill — parity with the mobile twin + the Library grid. */}
      <span
        className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-[var(--radius-card-lg)]"
        // ENG-1374 PR 2 — opaque cuisine-tint underlay on the wrapper (never
        // page white). Replaces the cool plum-grey `--background-secondary`
        // (§11.4 bans grey grounds under imagery).
        style={{ backgroundColor: recipeUnderlayColor({ id: recipe.id, title: recipe.title }, fallbackScheme, mediaPalette) }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            onError={() => setBroken(true)}
          />
        ) : (
          <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={28} />
        )}
      </span>
      <span className="block pt-2">
        <span className="line-clamp-2 block font-[family-name:var(--font-headline)] text-[15px] font-medium leading-[18px] text-foreground">
          {recipe.title}
        </span>
        <span className="mt-0.5 block truncate text-[11px] tabular-nums text-foreground-secondary">
          {meta}
        </span>
      </span>
    </button>
  );
}

export default RecipeCardWide;
