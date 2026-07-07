import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { RecipeCollection } from "../lib/recipes/recipeCollections.ts";
import { useAuthSession } from "./AuthSessionContext.tsx";
import { useRecipeCollectionsState } from "./appData/useRecipeCollectionsState.ts";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface RecipeCollectionsContextValue {
  /** ENG-1126 — user-created recipe collections (Paprika parity). */
  recipeCollections: RecipeCollection[];
  /** Per-recipe collection membership; keys are recipe ids, values are collection ids. */
  collectionMembershipByRecipeId: Readonly<Record<string, string[]>>;
  createCollection: (name: string) => Promise<boolean>;
  renameCollection: (collectionId: string, name: string) => Promise<boolean>;
  deleteCollection: (collectionId: string) => Promise<boolean>;
  addRecipeToCollection: (collectionId: string, recipeId: string) => Promise<boolean>;
  removeRecipeFromCollection: (collectionId: string, recipeId: string) => Promise<boolean>;
}

const RecipeCollectionsContext = createContext<RecipeCollectionsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * ENG-1364 (phase 2) — recipe collections split out of the `AppDataContext`
 * monolith. Chosen as the second domain because, despite living under the
 * phase-1 "recipe library" selector alongside `discoverRecipes` /
 * `savedRecipesForLibrary` / etc., collections are a genuinely independent
 * sub-domain: `useRecipeCollectionsState` was already a pure function of
 * `authedUserId` with its own Supabase table, and — unlike the
 * saved/discover recipe state — nothing in `generateMealPlan` or
 * `generateShoppingListFromPlan` reads collection membership. It is also not
 * part of the `usePersistLocalAppSnapshot` local-storage blob. The rest of
 * "recipe library" (`discoverRecipes`, `savedRecipeIds`, `toggleSaveRecipe`,
 * `savedRecipesForLibrary`, …) stays in `AppDataContext` for now — it is read
 * directly inside `generateMealPlan` / `generateShoppingListFromPlan` at
 * multiple call sites, which makes it a materially riskier split than this
 * PR's scope allows (see the phase-2 PR description for the full trace).
 */
export function RecipeCollectionsProvider({ children }: { children: ReactNode }) {
  const { authedUserId } = useAuthSession();
  const {
    recipeCollections,
    collectionMembershipByRecipeId,
    createCollection,
    renameCollection,
    deleteCollection,
    addRecipeToCollection,
    removeRecipeFromCollection,
  } = useRecipeCollectionsState({ authedUserId });

  const value = useMemo(
    (): RecipeCollectionsContextValue => ({
      recipeCollections,
      collectionMembershipByRecipeId,
      createCollection,
      renameCollection,
      deleteCollection,
      addRecipeToCollection,
      removeRecipeFromCollection,
    }),
    [
      recipeCollections,
      collectionMembershipByRecipeId,
      createCollection,
      renameCollection,
      deleteCollection,
      addRecipeToCollection,
      removeRecipeFromCollection,
    ],
  );

  return (
    <RecipeCollectionsContext.Provider value={value}>{children}</RecipeCollectionsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecipeCollections(): RecipeCollectionsContextValue {
  const ctx = useContext(RecipeCollectionsContext);
  if (!ctx) {
    throw new Error("useRecipeCollections must be used within RecipeCollectionsProvider");
  }
  return ctx;
}
