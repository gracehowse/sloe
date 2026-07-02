"use client";

import * as React from "react";
import { RecipeHeroFallback } from "../suppr/RecipeHeroFallback";

import type { RecipeCard } from "@/types/recipe";

/**
 * RecipeCardWide — the Sloe v3 Cookbook editorial-shelf card.
 *
 * WEB parity twin of `apps/mobile/components/library/RecipeCardWide.tsx`
 * (prototype `rcard--wide` ~L4176, `.rcard--wide{width:188px}` /
 * `.rcard-img{height:128px}`): a fixed 188px card with a 128px photo (or the deterministic
 * RecipeHeroFallback tint + glyph when none — honest imagery, ENG-1287), the recipe name (2 lines), and a
 * "{kcal} kcal · {protein}g P · {time}m" meta line — or "Nutrition pending · {time}m"
 * when calories are 0. Used inside {@link EditorialShelf}; behind
 * `sloe_v3_editorial_shelves` (host-gated).
 */
export interface RecipeCardWideProps {
  recipe: RecipeCard;
  onPress: () => void;
}

function totalMinutes(r: RecipeCard): number {
  const prep = Number.isFinite(r.prepTimeMin) ? (r.prepTimeMin as number) : 0;
  const cook = Number.isFinite(r.cookTimeMin) ? (r.cookTimeMin as number) : 0;
  return prep + cook;
}

export function RecipeCardWide({ recipe, onPress }: RecipeCardWideProps) {
  const [broken, setBroken] = React.useState(false);
  const showImage = Boolean(recipe.image) && !broken;
  const mins = totalMinutes(recipe);
  const hasKcal = recipe.calories > 0;
  const meta = [
    hasKcal
      ? `${Math.round(recipe.calories)} kcal · ${Math.round(recipe.protein)}g P`
      : "Nutrition pending",
    mins > 0 ? `${mins}m` : null,
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
        style={{ backgroundColor: "var(--background-secondary)" }}
      >
        {showImage && recipe.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.image}
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
