"use client";

import * as React from "react";
import { UtensilsCrossed } from "lucide-react";

import type { RecipeCard } from "../../../types/recipe";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import { deriveQuickWeeknight } from "../../../lib/discover/quickWeeknight";
import { creatorTintFor } from "../../../lib/discover/creatorChipPresentation";
import { totalRecipeDurationMin } from "../../../lib/recipes/totalDuration";
import { DiscoverRecipeImage } from "./discover-recipe-image";

/**
 * DiscoverQuickWeeknight — the Sloe v3 Discover "Quick weeknight" section
 * (ENG-1225 Block 6), WEB twin of `apps/mobile/components/discover/
 * DiscoverQuickWeeknight.tsx`. ENG-1618 makes the real recipe photo the
 * default card media; the flag-off branch preserves the prototype's dense
 * NO-PHOTO tint card. Self-gating on `sloe_v3_discover_editorial` + non-empty;
 * 2-col → 3-col (lg). Shares `deriveQuickWeeknight` with mobile.
 */
export interface DiscoverQuickWeeknightProps {
  recipes: RecipeCard[];
  onPressRecipe: (recipe: RecipeCard) => void;
  /** Feed position; omitted when the component is rendered in isolation. */
  placement?: "first" | "legacy";
}

export function DiscoverQuickWeeknight({
  recipes,
  onPressRecipe,
  placement,
}: DiscoverQuickWeeknightProps) {
  const enabled = isFeatureEnabled("sloe_v3_discover_editorial");
  const photographicFirstViewEnabled = isFeatureEnabled(
    "discover_photographic_first_view_v1",
  );
  // Design-consistency pass (2026-07-24), two fixes on this card:
  //  1. The cook time was printed TWICE — once as a white pill on the photo
  //     and again in the meta line ~60px below. The meta line is the shared
  //     recipe-card treatment (`library/RecipeCardWide`, `library/FeaturedHero`
  //     and the mobile twin all read "{kcal} kcal · {protein}g protein ·
  //     {mins} min"), so the pill is the redundant one — and it was the only
  //     raw `rgba()` colour on the card, painted over unpredictable photo
  //     content. Drop it; the meta line does the work.
  //  2. The protein figure rendered bare ("40g"), the only unlabelled datum
  //     in any recipe meta line in the product. Label it, matching the two
  //     sibling cards above.
  const unifiedChrome = isFeatureEnabled("design_consistency_v1");
  const quick = React.useMemo(() => deriveQuickWeeknight(recipes), [recipes]);
  if (
    !enabled ||
    (placement === "first" && !photographicFirstViewEnabled) ||
    quick.length === 0
  ) {
    return null;
  }
  const placementClass =
    placement === "first"
      ? "md:hidden"
      : placement === "legacy" && photographicFirstViewEnabled
        ? "hidden md:block"
        : "";

  return (
    // ENG-1503 — standard mobile page inset (`px-4 md:px-0`, matching the
    // sibling cluster sections in DiscoverFeed): the host container carries
    // no `< md` horizontal padding, so a section without its own inset
    // renders flush to the viewport edge.
    <section
      className={`mt-6 px-4 md:px-0 ${placementClass}`}
      data-testid={placement === "first" ? "discover-photographic-first-view" : undefined}
    >
      <div className="mb-2">
        <h2 className="font-[family-name:var(--font-headline)] text-[18px] font-medium leading-[22px] text-foreground">
          Quick weeknight
        </h2>
        <p className="mt-px text-[11px] text-foreground-tertiary">
          Fast wins for the nights you have no time
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {quick.map((r) => {
          // ENG-1617 — one shared total (prep + cook) selector, not a local sum.
          const mins = totalRecipeDurationMin(r.prepTimeMin, r.cookTimeMin);
          const meta = [
            r.calories > 0 ? `${Math.round(r.calories)} kcal` : null,
            r.protein > 0
              ? `${Math.round(r.protein)}g${unifiedChrome ? " protein" : ""}`
              : null,
            mins != null ? `${mins} min` : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onPressRecipe(r)}
              aria-label={`${r.title}, ${meta}`}
              className="group block text-left transition-transform active:scale-[0.99] focus-visible:outline-none"
            >
              <span
                data-testid={
                  photographicFirstViewEnabled
                    ? `quick-weeknight-photo-${r.id}`
                    : `quick-weeknight-tint-${r.id}`
                }
                className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg shadow-sm group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2"
                style={
                  photographicFirstViewEnabled
                    ? undefined
                    : { backgroundColor: creatorTintFor(r.id) }
                }
              >
                {photographicFirstViewEnabled ? (
                  <DiscoverRecipeImage
                    id={r.id}
                    title={r.title}
                    image={r.image}
                    aspectRatio="4 / 3"
                    sizes="(min-width: 1024px) 20vw, 50vw"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                ) : (
                  <UtensilsCrossed className="h-5 w-5 text-white opacity-50" />
                )}
                {!unifiedChrome && mins != null ? (
                  <span
                    className="absolute left-2 top-2 rounded-full px-[9px] py-1 text-[10px] font-semibold"
                    style={{ backgroundColor: "rgba(255,255,255,0.92)", color: "rgba(28,22,32,1)" }}
                  >
                    {mins} min
                  </span>
                ) : null}
              </span>
              <span className="mt-2 line-clamp-2 block font-[family-name:var(--font-headline)] text-[15px] leading-[19px] text-foreground">
                {r.title}
              </span>
              <span className="mt-0.5 block text-[11px] tabular-nums text-foreground-secondary">
                {meta}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default DiscoverQuickWeeknight;
