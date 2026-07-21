"use client";

import * as React from "react";
import { RecipeHeroFallback } from "../suppr/RecipeHeroFallback";
import { recipeUnderlayColor } from "../../../lib/recipe/recipeHeroFallback";
import { useFallbackScheme } from "../../../lib/theme/useFallbackScheme";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import { totalRecipeDurationMin } from "../../../lib/recipes/totalDuration";

import type { RecipeCard } from "@/types/recipe";

/**
 * FeaturedHero — the Sloe v3 Cookbook "Tonight's pick" featured card.
 *
 * WEB parity twin of `apps/mobile/components/library/FeaturedHero.tsx` (prototype
 * `cook-feat` ~L4283): a full-width card with a 150px photo (or the deterministic
 * RecipeHeroFallback tint + glyph when none — honest imagery, ENG-1287) carrying a "Tonight's pick" kick badge, then a
 * "From your cookbook" plum overline, the recipe title (serif), and a
 * "{kcal} kcal · {protein}g protein · {time} min" meta line. Sits above the
 * editorial shelves when the All filter is active. (Host-gated on the
 * category filter; the `sloe_v3_editorial_shelves` flag that gated this was
 * collapsed as always-on in ENG-1356.)
 */
export interface FeaturedHeroProps {
  recipe: RecipeCard;
  onPress: () => void;
}

export function FeaturedHero({ recipe, onPress }: FeaturedHeroProps) {
  const [broken, setBroken] = React.useState(false);
  const fallbackScheme = useFallbackScheme(); // ENG-1528 — dark ramp underlay on dark cards
  const mediaPalette = isFeatureEnabled("recipe_sparse_media_v1") ? "plum-duotone" : "legacy-cuisine";
  const image = recipe.image?.trim() ?? "";
  const showImage = image.length > 0 && !broken;
  // ENG-1617 — one shared total (prep + cook) selector, not a local sum.
  const mins = totalRecipeDurationMin(recipe.prepTimeMin, recipe.cookTimeMin);
  const meta = [
    recipe.calories > 0 ? `${Math.round(recipe.calories)} kcal` : null,
    recipe.protein > 0 ? `${Math.round(recipe.protein)}g protein` : null,
    mins != null ? `${mins} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`Tonight's pick: ${recipe.title}${meta ? `, ${meta}` : ""}`}
      className="mt-3 block w-full overflow-hidden rounded-[var(--radius-card-lg)] border text-left transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 hover:bg-[var(--background-secondary)] active:scale-[0.99]"
      style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}
    >
      <span
        className="relative flex h-[150px] w-full items-center justify-center overflow-hidden md:h-[260px]"
        // ENG-1374 PR 2 — opaque cuisine-tint underlay on the wrapper (never
        // page white). Replaces the cool plum-grey `--background-secondary` —
        // §11.4 bans grey grounds under imagery; the tint also kills the grey
        // flash while the photo streams in.
        style={{ backgroundColor: recipeUnderlayColor({ id: recipe.id, title: recipe.title }, fallbackScheme, mediaPalette) }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={32} />
        )}
        <span
          className="absolute left-3 top-3 rounded-full px-[11px] py-[5px] text-[10px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur-sm"
          // a11y (2026-06-23): scrim 0.5 → 0.68 so the white "Tonight's pick"
          // label clears AA (4.5:1) even over a LIGHT recipe photo (0.5 over
          // white composited to #878187 ≈ 3.8:1 — fail).
          style={{ backgroundColor: "rgba(28,18,26,0.68)" }}
        >
          Tonight&apos;s pick
        </span>
      </span>
      <span className="block px-4 pb-4 pt-3">
        <span
          className="block text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: "var(--primary)" }}
        >
          From your cookbook
        </span>
        <span className="mt-0.5 line-clamp-2 block font-[family-name:var(--font-headline)] text-[22px] font-semibold leading-tight tracking-tight text-foreground">
          {recipe.title}
        </span>
        {meta ? (
          <span className="mt-1 block text-[11px] tabular-nums text-foreground-tertiary">
            {meta}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export default FeaturedHero;
