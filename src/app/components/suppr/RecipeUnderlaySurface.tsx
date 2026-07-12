"use client";

import * as React from "react";

import {
  recipeUnderlayColor,
  type RecipeHeroInput,
} from "../../../lib/recipe/recipeHeroFallback";
import { useFallbackScheme } from "../../../lib/theme/useFallbackScheme";

/**
 * ENG-1528 — client wrapper that paints the never-white recipe underlay
 * (ENG-1374 PR 2) with the resolved scheme applied. The public recipe page
 * (`app/recipe/[id]/page.tsx`) is an async SERVER component, so it can't call
 * the `useFallbackScheme()` hook inline; it renders this tiny client `<div>`
 * instead, so a dark card gets the dark-ramp tint rather than a glowing cream
 * one — same behaviour as every hook-wired client consumer elsewhere.
 *
 * The recipe identity (`id`/`title`/`tags`) picks the deterministic tint; all
 * other `<div>` props (className, aria-label, …) pass through unchanged.
 */
export type RecipeUnderlaySurfaceProps = RecipeHeroInput &
  React.HTMLAttributes<HTMLDivElement>;

export function RecipeUnderlaySurface({
  id,
  title,
  tags,
  style,
  children,
  ...rest
}: RecipeUnderlaySurfaceProps) {
  const scheme = useFallbackScheme();
  return (
    <div
      style={{ ...style, backgroundColor: recipeUnderlayColor({ id, title, tags }, scheme) }}
      {...rest}
    >
      {children}
    </div>
  );
}

export default RecipeUnderlaySurface;
