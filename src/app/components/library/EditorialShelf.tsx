"use client";

import * as React from "react";

import type { RecipeCard } from "@/types/recipe";
import { RecipeCardWide } from "./RecipeCardWide";

/**
 * EditorialShelf — a Sloe v3 Cookbook shelf.
 *
 * WEB parity twin of `apps/mobile/components/library/EditorialShelf.tsx`
 * (prototype `cook-shelf` ~L4295, `.cook-shelf{gap:14px; margin:0 -20px;
 * scroll-snap-type:x mandatory}`): a section head (18px serif title + muted
 * 11px subtitle) above a horizontal snap-scroll of {@link RecipeCardWide} cards
 * that edge-bleeds the host's 20px padding (`-mx-5` / `px-5`). Memoized — a
 * shelf only re-renders when its recipe list changes. (Host-gated on the
 * category filter; the `sloe_v3_editorial_shelves` flag that gated this was
 * collapsed as always-on in ENG-1356.)
 */
export interface EditorialShelfProps {
  title: string;
  subtitle: string;
  recipes: RecipeCard[];
  onPressRecipe: (recipe: RecipeCard) => void;
}

function EditorialShelfBase({
  title,
  subtitle,
  recipes,
  onPressRecipe,
}: EditorialShelfProps) {
  return (
    <section className="mt-6">
      <div className="mb-2">
        <h2 className="font-[family-name:var(--font-headline)] text-[18px] font-medium leading-[22px] tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-px text-[11px] text-foreground-tertiary">{subtitle}</p>
      </div>
      <div className="-mx-5 flex snap-x snap-mandatory gap-[14px] overflow-x-auto px-5 py-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {recipes.map((r) => (
          <RecipeCardWide
            key={r.id}
            recipe={r}
            onPress={() => onPressRecipe(r)}
          />
        ))}
      </div>
    </section>
  );
}

export const EditorialShelf = React.memo(EditorialShelfBase);

export default EditorialShelf;
