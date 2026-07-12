"use client";

import { memo } from "react";
import { Check, ChevronRight, Circle, Flame, Shield } from "lucide-react";
import { AvatarDisc } from "../ui/avatar-disc";
import { RecipeHeroFallback } from "../suppr/RecipeHeroFallback";
import { recipeUnderlayColor } from "../../../lib/recipe/recipeHeroFallback";
import { useFallbackScheme } from "../../../lib/theme/useFallbackScheme";
import {
  type EditorialProfileBlockModel,
  type StreakDotState,
} from "../../../lib/profile/editorialProfileBlock";

/** Minimal recipe shape the grid needs — a subset of RecipeCard so the
 *  component doesn't drag the full type into the profile surface. */
export interface EditorialProfileRecipe {
  id: string;
  title: string;
  image: string | null;
}

export interface EditorialProfileBlockProps {
  displayName: string;
  joinedLabel: string | null;
  monogramInitial: string;
  tierLabel: string;
  isPro: boolean;
  /** Derived streak/dots/milestones model (from buildEditorialProfileBlock). */
  model: EditorialProfileBlockModel;
  /** Saved recipes for the preview grid (already loaded — no fetch here). */
  recipes: EditorialProfileRecipe[];
  /** Total saved-recipe count (may exceed the previewed grid). */
  recipeCount: number;
  /** Open a recipe from the grid. */
  onOpenRecipe: (recipeId: string) => void;
  /** "See all" → the recipe library. */
  onSeeAllRecipes: () => void;
}

/** Max recipes rendered in the preview grid — one tidy 2×3 wall. */
const RECIPE_GRID_LIMIT = 6;

const DOT_CLASSES: Record<StreakDotState, string> = {
  // m9: logged dot uses the darker `success-solid` (matches mobile's
  // `accent.successSolid`) so it stays legible on the white card.
  logged: "bg-success-solid",
  frozen: "bg-muted-foreground/40",
  missed: "bg-muted",
};

/**
 * EditorialProfileBlock — the shared editorial Profile block (Gap #16,
 * ENG-1246). Replaces the old inline identity strip + bare streak-number /
 * recipe-count tiles with one editorial surface: identity → streak dots +
 * best/freezes line → milestones list → recipe grid.
 *
 * Display-only: every value is derived upstream from already-loaded data
 * (freeze ledger, saved recipes). No fetches, no writes. Web twin of the
 * mobile `EditorialProfileBlock` — same information architecture, web
 * primitives.
 */
function EditorialProfileBlockImpl({
  displayName,
  joinedLabel,
  monogramInitial,
  tierLabel,
  isPro,
  model,
  recipes,
  recipeCount,
  onOpenRecipe,
  onSeeAllRecipes,
}: EditorialProfileBlockProps) {
  const gridRecipes = recipes.slice(0, RECIPE_GRID_LIMIT);
  const fallbackScheme = useFallbackScheme(); // ENG-1528 — dark ramp underlay on dark cards
  const freezeCount = model.freezesAvailable;

  return (
    <div className="flex flex-col gap-4" data-testid="editorial-profile-block">
      {/* Identity — monogram + name + tier·joined + tier pill. */}
      {/* m8: p-4/gap-4 (16px) to match the sibling cards + the mobile value
          (was off-scale p-3.5/gap-3.5). */}
      <div className="flex items-center gap-4 rounded-xl bg-card p-4 card-slab">
        {/* S5 avatar ruling (2026-07-10, ENG-1375): the ad-hoc bg-primary
            monogram → the ONE solid-damson identity disc (`AvatarDisc`). */}
        <AvatarDisc initial={monogramInitial} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-headline)] text-lg font-medium leading-tight text-foreground">
            {displayName.trim() ? displayName : "Your profile"}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {tierLabel}
            {joinedLabel ? ` · ${joinedLabel}` : ""}
          </p>
        </div>
        {isPro ? (
          <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary-solid">
            {tierLabel}
          </span>
        ) : null}
      </div>

      {/* Streak — dot row + best/freezes line. */}
      <div className="flex flex-col gap-3 rounded-xl bg-card p-4 card-slab">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Flame className="h-4 w-4 text-primary-solid" aria-hidden />
            {model.currentStreak}-day streak
          </p>
          {freezeCount > 0 ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Shield className="h-3.5 w-3.5" aria-hidden />
              {freezeCount} freeze{freezeCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div
          className="flex items-center gap-2"
          role="img"
          aria-label={`Last ${model.dots.length} days: ${model.dots
            .map((d) => d.state)
            .join(", ")}`}
        >
          {model.dots.map((dot) => (
            <span
              key={dot.dateKey}
              className={`h-2.5 w-2.5 rounded-full ${DOT_CLASSES[dot.state]} ${
                dot.isToday ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-card" : ""
              }`}
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Best streak {model.bestStreak} day{model.bestStreak === 1 ? "" : "s"}
          {freezeCount > 0
            ? ` · ${freezeCount} freeze${freezeCount === 1 ? "" : "s"} in hand`
            : ""}
        </p>
      </div>

      {/* Milestones — list of streak landmarks with achieved / next state. */}
      <div className="flex flex-col gap-2 rounded-xl bg-card p-4 card-slab">
        <p className="text-sm font-semibold text-foreground">Milestones</p>
        <ul className="flex flex-col gap-2">
          {model.milestones.map((m) => (
            <li key={m.days} className="flex items-center gap-3">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                  m.achieved
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground"
                }`}
                aria-hidden
              >
                {m.achieved ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </span>
              <span
                className={`flex-1 text-[13px] ${
                  m.achieved ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {m.days}-day streak
              </span>
              {m.next ? (
                <span className="text-[11px] font-semibold text-primary-solid">Next up</span>
              ) : m.achieved ? (
                <span className="text-[11px] text-muted-foreground">Reached</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {/* Recipe grid — saved recipes preview (already-loaded rows). */}
      <div className="flex flex-col gap-3 rounded-xl bg-card p-4 card-slab">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Saved recipes</p>
          {recipeCount > 0 ? (
            <button
              type="button"
              onClick={onSeeAllRecipes}
              aria-label={`See all ${recipeCount} saved recipes`}
              className="flex items-center gap-0.5 rounded-md text-[11px] font-semibold text-primary-solid transition-colors hover:text-primary-solid/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              See all {recipeCount}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        {gridRecipes.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">
            Recipes you save land here. Browse Discover to start your collection.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {gridRecipes.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onClick={() => onOpenRecipe(recipe.id)}
                aria-label={`Open ${recipe.title}`}
                className="group relative aspect-square overflow-hidden rounded-lg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                // ENG-1374 PR 2 — opaque cuisine-tint underlay on the wrapper
                // (never page white, whatever the child does).
                style={{ backgroundColor: recipeUnderlayColor({ id: recipe.id, title: recipe.title }, fallbackScheme) }}
              >
                {recipe.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={recipe.image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <RecipeHeroFallback id={recipe.id} title={recipe.title} iconSize={24} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const EditorialProfileBlock = memo(EditorialProfileBlockImpl);

export default EditorialProfileBlock;
