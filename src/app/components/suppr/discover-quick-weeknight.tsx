"use client";

import * as React from "react";
import { UtensilsCrossed } from "lucide-react";

import type { RecipeCard } from "../../../types/recipe";
import { isFeatureEnabled } from "../../../lib/analytics/track";
import { deriveQuickWeeknight } from "../../../lib/discover/quickWeeknight";
import { creatorTintFor } from "../../../lib/discover/creatorChipPresentation";

/**
 * DiscoverQuickWeeknight — the Sloe v3 Discover "Quick weeknight" section
 * (ENG-1225 Block 6), WEB twin of `apps/mobile/components/discover/
 * DiscoverQuickWeeknight.tsx`. Fast recipes as dense NO-PHOTO tint cards
 * (prototype `.w-rgrid` / `.w-rcard`, Sloe-App.html L7570). Self-gating on
 * `sloe_v3_discover_editorial` + non-empty; 2-col → 3-col (lg). Shares
 * `deriveQuickWeeknight` + `creatorTintFor` with mobile.
 */
export interface DiscoverQuickWeeknightProps {
  recipes: RecipeCard[];
  onPressRecipe: (recipe: RecipeCard) => void;
}

function minutesOf(r: RecipeCard): number {
  const prep = typeof r.prepTimeMin === "number" ? r.prepTimeMin : 0;
  const cook = typeof r.cookTimeMin === "number" ? r.cookTimeMin : 0;
  return prep + cook;
}

export function DiscoverQuickWeeknight({
  recipes,
  onPressRecipe,
}: DiscoverQuickWeeknightProps) {
  const enabled = isFeatureEnabled("sloe_v3_discover_editorial");
  const quick = React.useMemo(() => deriveQuickWeeknight(recipes), [recipes]);
  if (!enabled || quick.length === 0) return null;

  return (
    // ENG-1503 — standard mobile page inset (`px-4 md:px-0`, matching the
    // sibling cluster sections in DiscoverFeed): the host container carries
    // no `< md` horizontal padding, so a section without its own inset
    // renders flush to the viewport edge.
    <section className="mt-6 px-4 md:px-0">
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
          const mins = minutesOf(r);
          const meta = [
            r.calories > 0 ? `${Math.round(r.calories)} kcal` : null,
            r.protein > 0 ? `${Math.round(r.protein)}g` : null,
            mins > 0 ? `${mins} min` : null,
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
                className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg shadow-sm group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2"
                style={{ backgroundColor: creatorTintFor(r.id) }}
              >
                <UtensilsCrossed className="h-5 w-5 text-white opacity-50" />
                {mins > 0 ? (
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
