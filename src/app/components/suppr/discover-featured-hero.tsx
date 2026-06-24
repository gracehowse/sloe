"use client";

import * as React from "react";

import type { RecipeCard } from "../../../types/recipe";
import { Icons } from "../ui/icons";
import { DiscoverRecipeImage } from "./discover-recipe-image";
import { displayAttribution } from "../../../lib/recipes/displayAttribution";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import {
  creatorInitialOf,
  creatorTintFor,
} from "../../../lib/discover/creatorChipPresentation";

/**
 * DiscoverFeaturedHero — the v3 Discover "featured" block (ENG-1225 #14,
 * prototype `.w-feat`, Sloe-App.html L7546-7552): a large two-pane card at the
 * top of WEB Discover — photo on the left, "Trending this week" eyebrow + serif
 * title + a kcal/protein/min metric triad + a creator byline + "View recipe"
 * CTA on the right. WEB STAYS CARDED (the prototype's `.w-feat` is a carded
 * surface); the mobile Discover already has its own editorial hero, so this web
 * hero is the parity addition for the wide desktop canvas.
 *
 * Two exports so the host stays thin (the pinned `DiscoverFeed.tsx` only renders
 * `<DiscoverFeaturedHero .../>`):
 *  - `DiscoverFeaturedHero` (default host entry) SELF-GATES on
 *    `discover_creator_rail_v1` (default-OFF) + the default-view flag + a
 *    photo-bearing recipe, picks the recipe, and renders the card. Renders
 *    nothing when the flag is off / the feed is narrowed / no recipe exists.
 *  - `DiscoverFeaturedHeroCard` is the presentation (stories + tests target it).
 *
 * Renders only at `md+` (the desktop two-pane prototype). Tap anywhere (or the
 * CTA) opens the recipe; the byline taps through to the creator when linked.
 */
export interface DiscoverFeaturedHeroCardProps {
  /** The recipe to feature. */
  recipe: RecipeCard;
  /** Open the featured recipe. */
  onOpenRecipe: (recipe: RecipeCard) => void;
  /** Open the creator profile (when the recipe has a linked creator). */
  onOpenCreator?: (creatorId: string) => void;
}

export interface DiscoverFeaturedHeroProps
  extends Omit<DiscoverFeaturedHeroCardProps, "recipe"> {
  /** The Discover feed recipes — the first photo-bearing one is featured. */
  recipes: RecipeCard[];
  /** True only on the default unfiltered view (so the hero never fights a query). */
  defaultView: boolean;
}

/** Host entry: self-gates on the flag + default view + a recipe, then renders. */
export function DiscoverFeaturedHero({
  recipes,
  defaultView,
  onOpenRecipe,
  onOpenCreator,
}: DiscoverFeaturedHeroProps) {
  const enabled = isFeatureEnabled("discover_creator_rail_v1");
  const recipe = React.useMemo(
    () =>
      enabled && defaultView
        ? (recipes.find((r) => (r.image ?? "").trim().length > 0) ?? recipes[0] ?? null)
        : null,
    [enabled, defaultView, recipes],
  );
  if (!recipe) return null;
  return (
    <DiscoverFeaturedHeroCard
      recipe={recipe}
      onOpenRecipe={onOpenRecipe}
      onOpenCreator={onOpenCreator}
    />
  );
}

export function DiscoverFeaturedHeroCard({
  recipe,
  onOpenRecipe,
  onOpenCreator,
}: DiscoverFeaturedHeroCardProps) {
  const kcal = Math.round(recipe.calories);
  const protein = Math.round(recipe.protein);
  const cookTimeMin =
    recipe.cookTimeMin ??
    (recipe.cookTime ? parseInt(recipe.cookTime, 10) || null : null);
  const byline = displayAttribution({ creatorName: recipe.creatorName });
  const creatorId = recipe.creatorId ?? null;

  const metrics: { label: string; value: string }[] = [
    { label: "Kcal", value: kcal > 0 ? String(kcal) : "—" },
    { label: "Protein", value: protein > 0 ? `${protein}g` : "—" },
    ...(cookTimeMin ? [{ label: "Min", value: String(cookTimeMin) }] : []),
  ];

  return (
    <section
      data-testid="discover-featured-hero"
      className="hidden md:block mt-6"
      aria-label="Trending this week"
    >
      <div
        data-testid="discover-featured-hero-card"
        className="group relative grid grid-cols-[1.05fr_1fr] overflow-hidden rounded-3xl bg-card shadow-md transition-shadow hover:shadow-lg focus-within:shadow-lg"
      >
        {/* Stretched primary action — covers the whole card to open the recipe.
            A real <button> (not a role="button" div), so keyboard + SR get a
            proper control. The creator button below sits at a higher z-index, so
            both are siblings — no nested-interactive a11y violation. */}
        <button
          type="button"
          onClick={() => onOpenRecipe(recipe)}
          aria-label={`Open recipe: ${recipe.title}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        />
        <div className="relative min-h-[280px] overflow-hidden">
          <DiscoverRecipeImage
            id={recipe.id}
            title={recipe.title}
            image={recipe.image}
            iconSize={32}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex flex-col justify-center p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-primary-solid">
            Trending this week
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-headline)] text-[28px] font-medium leading-[1.1] text-foreground line-clamp-2">
            {recipe.title}
          </h2>
          <div className="mt-5 flex gap-6">
            {metrics.map((m) => (
              <div key={m.label}>
                <span className="block font-[family-name:var(--font-headline)] text-[22px] font-semibold tabular-nums text-foreground">
                  {m.value}
                </span>
                <span className="text-[11px] uppercase tracking-[0.04em] text-foreground-tertiary">
                  {m.label}
                </span>
              </div>
            ))}
          </div>
          {byline ? (
            <div className="mt-5">
              {creatorId && onOpenCreator ? (
                <button
                  type="button"
                  onClick={() => onOpenCreator(creatorId)}
                  className="relative z-20 inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
                >
                  <span
                    className="inline-flex size-7 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-[13px] text-white"
                    style={{ background: creatorTintFor(creatorId) }}
                    aria-hidden
                  >
                    {creatorInitialOf(byline)}
                  </span>
                  <span className="text-[13px] font-medium text-primary-solid group-hover:underline">
                    {byline}
                  </span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-flex size-7 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-[13px] text-white"
                    style={{ background: creatorTintFor(recipe.id) }}
                    aria-hidden
                  >
                    {creatorInitialOf(byline)}
                  </span>
                  <span className="text-[13px] font-medium text-foreground-secondary">
                    {byline}
                  </span>
                </span>
              )}
            </div>
          ) : null}
          <span className="mt-6 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-solid px-4 py-2 text-[13px] font-semibold text-white">
            <Icons.forward className="size-4" aria-hidden />
            View recipe
          </span>
        </div>
      </div>
    </section>
  );
}

export default DiscoverFeaturedHero;
