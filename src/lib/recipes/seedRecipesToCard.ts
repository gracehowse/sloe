/**
 * seedRecipesToCard — adapt the static seed shape (`SeedRecipe`) to the
 * RecipeCard wire shape consumed by Discover on both mobile and web.
 *
 * Cross-platform: web `RecipeCard` and mobile `RecipeCard` share the
 * same minimum shape (id / title / image / macros / servings / time).
 * This helper returns a structural-typed object using only those
 * fields — both platforms accept it without `as any` casts because
 * each declares its own RecipeCard interface and the shared subset is
 * compatible.
 *
 * Why a shared helper rather than two: the seed source already lives
 * in a single file (`seedRecipesV2.ts`); adapting it twice would let
 * the platforms drift on the (already minor) field mappings. One
 * mapper, both platforms, one test.
 */
import type { SeedRecipe } from "./seedRecipesV2";

/**
 * Minimum subset of RecipeCard that satisfies the discover surfaces on
 * both web (`src/types/recipe.ts`) and mobile (`apps/mobile/lib/types.ts`).
 * We deliberately don't import either declaration — the seed adapter
 * stays decoupled so neither platform has to compile the other's
 * types.
 */
export interface SeedRecipeCard {
  id: string;
  title: string;
  image: string;
  creatorName: string;
  creatorImage: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  isVerified: boolean;
  savedCount: number;
  saves: number;
  isSaved: boolean;
  authorId: string | null;
  creatorId: string | null;
  sourceUrl: string | null;
  prepTime: string;
  cookTime: string;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  feedSource: "catalog";
  /** Cluster id — used by Discover to group seeds into carousels. */
  cluster: SeedRecipe["cluster"];
}

/** Render minutes as "N min" when known, else empty string (the
 *  Discover card hides the row when empty). Mirrors
 *  `apps/mobile/lib/formatRecipeMinutes.ts`. */
function fmtMin(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "";
  return `${Math.round(n)} min`;
}

/**
 * One seed entry → one RecipeCard-shaped object. Idempotent + pure.
 */
export function seedToRecipeCard(seed: SeedRecipe): SeedRecipeCard {
  // Curated avatar — neutral placeholder so the card byline reads
  // "Suppr Kitchen" without surfacing a real user identity. The
  // avatar is a 1x1 transparent GIF; Discover renders the byline
  // text and the icon only when an avatar is present.
  const NEUTRAL_AVATAR =
    "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

  return {
    id: seed.id,
    title: seed.title,
    image: seed.heroImageUrl,
    creatorName: "Suppr Kitchen",
    creatorImage: NEUTRAL_AVATAR,
    servings: seed.servings,
    calories: seed.kcalPerPortion,
    protein: seed.proteinG,
    carbs: seed.carbsG,
    fat: seed.fatG,
    fiberG: seed.fiberG,
    isVerified: true,
    savedCount: 0,
    saves: 0,
    isSaved: false,
    authorId: null,
    creatorId: null,
    sourceUrl: null,
    prepTime: fmtMin(seed.prepTimeMin),
    cookTime: fmtMin(seed.cookTimeMin),
    prepTimeMin: seed.prepTimeMin > 0 ? seed.prepTimeMin : null,
    cookTimeMin: seed.cookTimeMin > 0 ? seed.cookTimeMin : null,
    feedSource: "catalog",
    cluster: seed.cluster,
  };
}

/** Map an array of SeedRecipes to RecipeCard-shaped objects. */
export function seedsToRecipeCards(seeds: ReadonlyArray<SeedRecipe>): SeedRecipeCard[] {
  return seeds.map(seedToRecipeCard);
}
