/**
 * Library editorial shelves (Sloe v3 Cookbook, ENG-1225 Block 5).
 *
 * Three semantic shelves carved from the user's filtered library, matching the
 * v3 prototype (`docs/ux/redesign/v3/Sloe-App.html` Cook ~L4169-4171):
 *
 *   - "Fits your day"      → ≤ 600 kcal/serving
 *   - "Quick — under 30 min" → ≤ 30 min total (reuses `isQuick`)
 *   - "High protein"       → ≥ 27 g protein/serving
 *
 * Each shelf is capped at 6 and empty shelves are dropped, so the caller can map
 * straight to UI. This pure derivation is SHARED between mobile
 * (`useLibraryShelves`) and web (`Library.tsx`) so the two platforms cannot
 * drift on thresholds, caps, or copy — the same contract as `planWeekStatus`.
 */
import { isQuick, type LibraryFilterRecipe } from "./libraryFilters";

/** ≤ this many kcal/serving lands a recipe in "Fits your day". */
export const SHELF_FITS_KCAL_MAX = 600;
/** ≥ this many grams of protein/serving lands a recipe in "High protein". */
export const SHELF_HIGH_PROTEIN_G = 27;
/** Max cards per shelf. */
export const SHELF_CAP = 6;

/** Narrow shape a shelf needs — both RecipeCard types are structural supersets. */
export interface LibraryShelfRecipe extends LibraryFilterRecipe {
  calories: number;
  protein: number;
}

export type LibraryShelfKey = "fits" | "quick" | "high-protein";

export interface LibraryShelf<T> {
  key: LibraryShelfKey;
  title: string;
  subtitle: string;
  recipes: T[];
}

export type LibraryCompositionMode = "empty" | "single" | "pair" | "many";

export interface LibraryComposition<T> {
  mode: LibraryCompositionMode;
  featured: T | null;
  shelves: LibraryShelf<T>[];
  gridRecipes: T[];
}

/** `true` when a recipe has a real, positive calorie count at/under the cap. */
function fitsYourDay(r: LibraryShelfRecipe): boolean {
  return Number.isFinite(r.calories) && r.calories > 0 && r.calories <= SHELF_FITS_KCAL_MAX;
}

/** `true` when a recipe meets the high-protein shelf threshold. */
function isHighProteinShelf(r: LibraryShelfRecipe): boolean {
  return Number.isFinite(r.protein) && r.protein >= SHELF_HIGH_PROTEIN_G;
}

/**
 * Derive the (non-empty, capped) editorial shelves for a filtered recipe list.
 * Order is fixed: Fits your day → Quick → High protein.
 */
export function deriveLibraryShelves<T extends LibraryShelfRecipe>(
  recipes: readonly T[],
): LibraryShelf<T>[] {
  const shelves: LibraryShelf<T>[] = [
    {
      key: "fits",
      title: "Fits your day",
      subtitle: "Lands your protein, sits inside what's left",
      recipes: recipes.filter(fitsYourDay).slice(0, SHELF_CAP),
    },
    {
      key: "quick",
      title: "Quick — under 30 min",
      subtitle: "Weeknight-fast, minimal washing up",
      recipes: recipes.filter((r) => isQuick(r)).slice(0, SHELF_CAP),
    },
    {
      key: "high-protein",
      title: "High protein",
      subtitle: "27g+ to close your gap",
      recipes: recipes.filter(isHighProteinShelf).slice(0, SHELF_CAP),
    },
  ];
  return shelves.filter((s) => s.recipes.length > 0);
}

/**
 * ENG-1575 — deterministic sparse Library composition. With the rollout on,
 * one recipe appears once as the editorial hero; two recipes appear once each
 * (hero + grid). Three-or-more preserves the existing editorial density.
 */
export function deriveLibraryComposition<T extends LibraryShelfRecipe & { id: string }>(
  recipes: readonly T[],
  sparseMediaEnabled: boolean,
): LibraryComposition<T> {
  const shelves = deriveLibraryShelves(recipes);
  const featured = shelves[0]?.recipes[0] ?? recipes[0] ?? null;
  if (!sparseMediaEnabled || recipes.length >= 3) {
    return {
      mode: recipes.length === 0 ? "empty" : recipes.length === 1 ? "single" : recipes.length === 2 ? "pair" : "many",
      featured,
      shelves,
      gridRecipes: [...recipes],
    };
  }
  if (!featured) {
    return { mode: "empty", featured: null, shelves: [], gridRecipes: [] };
  }
  return {
    mode: recipes.length === 1 ? "single" : "pair",
    featured,
    shelves: [],
    gridRecipes: recipes.filter((recipe) => recipe.id !== featured.id),
  };
}
