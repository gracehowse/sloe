import {
  fetchCanonicalRecipeTitle,
  type RecipeTitleLookupClient,
} from "@suppr/nutrition-core/resolveRecipeLogTitles";
import { supabase } from "@/lib/supabase";

/** Typed once — avoids TS2589 deep-instantiation at every call site. */
const recipeTitleClient = supabase as unknown as RecipeTitleLookupClient;

export function fetchMobileCanonicalRecipeTitle(
  recipeId: string | null | undefined,
): Promise<string | null> {
  return fetchCanonicalRecipeTitle(recipeTitleClient, recipeId);
}
