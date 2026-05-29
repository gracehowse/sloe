import {
  updateRecipePublishedStatus,
  type RecipePublishSupabaseClient,
} from "@suppr/shared/recipes/goPublic";
import { supabase } from "@/lib/supabase";

/** Typed once — avoids Supabase generic depth at call sites. */
const publishClient = supabase as unknown as RecipePublishSupabaseClient;

export function updateMobileRecipePublishedStatus(params: {
  recipeId: string;
  authorId: string;
  published: boolean;
}) {
  return updateRecipePublishedStatus(publishClient, params);
}
