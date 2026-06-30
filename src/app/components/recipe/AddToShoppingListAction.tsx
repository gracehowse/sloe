import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import type { Dispatch, SetStateAction } from "react";

import { supabase } from "../../../lib/supabase/browserClient.ts";
import { track } from "../../../lib/analytics/track.ts";
import { AnalyticsEvents } from "../../../lib/analytics/events.ts";
import { shoppingScopeFor } from "../../../lib/household/shoppingScope.ts";
import { appendRecipeToShoppingListClient } from "../../../lib/planning/appendRecipeToShoppingListClient.ts";
import {
  buildingYourListMessage,
  type RecipeIngredientLine,
} from "../../../lib/planning/appendRecipeToShoppingList.ts";
import type { ShoppingItem } from "../../../types/recipe.ts";

/**
 * ENG-943 — "Add to shopping list" action for the web RecipeDetail. The host is
 * screen-budget-pinned, so the parse + aggregate + persist + feedback logic
 * lives here; RecipeDetail renders this one component (flag-gated).
 *
 * Mobile mirror: `apps/mobile/components/recipe/AddToShoppingListButton.tsx`.
 *
 * Tertiary affordance (outline pill) — the screen's filled CTAs (Save / Log)
 * stay dominant. Calm "building your list" framing (lists are ingredients; no
 * health claims). Default-ON via `recipe_shopping_list_v1`.
 */
type AddToShoppingListActionProps = {
  recipeId: string;
  recipeTitle: string;
  userId: string | null;
  activeHouseholdId: string | null;
  ingredients: readonly RecipeIngredientLine[];
  /** Servings-view multiplier so the list buys the on-screen scaled amount. */
  multiplier?: number;
  /** Local shopping state so the list updates without a refetch. */
  setShoppingItems: Dispatch<SetStateAction<ShoppingItem[]>>;
};

export function AddToShoppingListAction({
  recipeId,
  recipeTitle,
  userId,
  activeHouseholdId,
  ingredients,
  multiplier = 1,
  setShoppingItems,
}: AddToShoppingListActionProps) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    if (!userId) {
      toast.error("Sign in to build a shopping list.");
      return;
    }
    if (ingredients.length === 0) {
      toast("Nothing to add — this recipe has no ingredients yet.");
      return;
    }
    setBusy(true);
    try {
      const scope = shoppingScopeFor({ userId, householdId: activeHouseholdId });
      const res = await appendRecipeToShoppingListClient({
        client: supabase as unknown as Parameters<typeof appendRecipeToShoppingListClient>[0]["client"],
        scope,
        recipeTitle,
        ingredients,
        multiplier,
      });
      if (!res.ok) {
        toast.error("Couldn't update your list — please try again.");
        return;
      }
      // Reflect the merged list locally (preserves checked state on existing rows).
      setShoppingItems(res.items);
      track(AnalyticsEvents.recipe_shopping_list_added, {
        recipeId,
        ingredientCount: res.ingredientCount,
        addedCount: res.addedCount,
        mergedCount: res.mergedCount,
        platform: "web",
      });
      toast.success(buildingYourListMessage(res));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      aria-busy={busy}
      aria-label="Add ingredients to shopping list"
      data-testid="recipe-add-to-shopping-list"
      className="mt-3 inline-flex items-center gap-2 rounded-full border-[1.5px] border-primary-solid px-5 py-2.5 text-sm font-semibold text-primary-solid bg-transparent hover:bg-primary/5 active:bg-primary/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <ShoppingCart width={16} height={16} aria-hidden />
      {busy ? "Building your list…" : "Add to shopping list"}
    </button>
  );
}
