import type { SupabaseClient } from "@supabase/supabase-js";
import { persistImportRecipe } from "./persistImportRecipe";
import type { PlanImportNutritionMode, PlanImportVerifiedRecipe } from "./types";

export type CookbookImportCommitInput = {
  userId: string;
  bookName: string;
  recipes: PlanImportVerifiedRecipe[];
  nutritionMode: PlanImportNutritionMode;
};

export type CookbookImportCommitResult =
  | {
      ok: true;
      savedCount: number;
      recipeIdByKey: Record<string, string>;
      stoppedEarly: boolean;
      stopReason?: "save_limit" | "error";
      lastError?: string;
    }
  | { ok: false; error: string; savedCount: number };

/** Free tier library save cap (matches RLS on `saves`). */
export const COOKBOOK_IMPORT_FREE_SAVE_CAP = 10;

/**
 * Save selected cookbook recipes to Library only — no plan template.
 * Stops on first hard error or when free-tier save cap is hit.
 */
export async function commitCookbookImport(
  supabase: SupabaseClient,
  input: CookbookImportCommitInput,
  options?: { maxSaves?: number },
): Promise<CookbookImportCommitResult> {
  const maxSaves = options?.maxSaves;
  const recipeIdByKey: Record<string, string> = {};
  let savedCount = 0;

  for (const recipe of input.recipes) {
    if (maxSaves != null && savedCount >= maxSaves) {
      return {
        ok: true,
        savedCount,
        recipeIdByKey,
        stoppedEarly: true,
        stopReason: "save_limit",
        lastError:
          "Free plan is limited to 10 saved recipes. Upgrade to save more.",
      };
    }

    const res = await persistImportRecipe(
      supabase,
      input.userId,
      input.bookName,
      recipe,
      input.nutritionMode,
    );
    if ("error" in res) {
      const isSaveLimit =
        res.error.includes("10 saved") || res.error.includes("save limit");
      if (isSaveLimit && savedCount > 0) {
        return {
          ok: true,
          savedCount,
          recipeIdByKey,
          stoppedEarly: true,
          stopReason: "save_limit",
          lastError: res.error,
        };
      }
      if (savedCount > 0) {
        return {
          ok: true,
          savedCount,
          recipeIdByKey,
          stoppedEarly: true,
          stopReason: "error",
          lastError: res.error,
        };
      }
      return { ok: false, error: res.error, savedCount: 0 };
    }
    recipeIdByKey[recipe.key] = res.recipeId;
    savedCount += 1;
  }

  if (savedCount === 0) {
    return { ok: false, error: "No recipes were saved.", savedCount: 0 };
  }

  return {
    ok: true,
    savedCount,
    recipeIdByKey,
    stoppedEarly: false,
  };
}
