/**
 * Founder-approved Sloe Kitchen recipes for the Discover surface.
 *
 * This is the shared web/mobile catalogue. Recipe copy is original Sloe
 * Kitchen wording, every hero is a selected OpenAI-generated image hosted in
 * Suppr's public recipe-images bucket, and headline nutrition is generated
 * from the weighed ingredients by the canonical verification engine. The
 * previous 50-recipe Unsplash catalogue is intentionally replaced: rejected
 * or unreviewed imagery must not leak back into Discover.
 *
 * Source content and audit manifests live in `content/sloe-kitchen/v1`.
 * `scripts/build-sloe-kitchen-discover-seed.mjs` emits the static data module
 * under `src/lib` so Expo/Metro and Next consume exactly the same records.
 */

import { SLOE_KITCHEN_SEED_DATA } from "./sloeKitchenSeedData";

export type SeedCuisineCluster = "mediterranean" | "asian" | "latin";

export interface SeedIngredient {
  /** Display name, including preparation where the cooking method needs it. */
  name: string;
  /** Edible recipe quantity in grams. */
  grams: number;
}

export interface SeedAttribution {
  author: "Sloe Kitchen";
  origin: "original" | "ai-generated-edited";
  imageSource: {
    provider: "openai-imagegen";
    /** Public production asset rendered by Discover. */
    url: string;
    /** Immutable generation-history pointer from the selection review. */
    sourceArtifact: string;
  };
  notes?: string;
}

export interface SeedNutritionVerification {
  status: "verified";
  engine: "verifyIngredients";
  minIngredientConfidence: number;
  avgIngredientConfidence: number;
}

export interface SeedRecipe {
  /** Stable id. Convention: `seed-v2-{cluster}-{slug}`. */
  id: string;
  cluster: SeedCuisineCluster;
  title: string;
  heroImageUrl: string;
  totalTimeMin: number;
  prepTimeMin: number;
  cookTimeMin: number;
  servings: number;
  kcalPerPortion: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  ingredients: ReadonlyArray<SeedIngredient>;
  steps: ReadonlyArray<string>;
  shortDescription: string;
  tags?: ReadonlyArray<string>;
  allergens: ReadonlyArray<string>;
  nutritionVerification: SeedNutritionVerification;
  attribution: SeedAttribution;
}

export const SEED_RECIPES_V2: ReadonlyArray<SeedRecipe> =
  SLOE_KITCHEN_SEED_DATA;

export const SEED_RECIPE_ID_PREFIX = "seed-v2-" as const;

export function isSeedRecipeId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(SEED_RECIPE_ID_PREFIX);
}

const CURRENT_SEED_RECIPE_IDS = new Set(
  SEED_RECIPES_V2.map((recipe) => recipe.id),
);

/**
 * Detect catalogue rows from superseded Discover seed sets.
 *
 * Older app builds cached the previous `seed-v2-*` catalogue, while the live
 * database can still contain platform-authored Suppr/Sloe Kitchen rows with
 * UUID ids. Both must be removed before the current founder-approved
 * catalogue is prepended, otherwise a cold/offline mobile session can mix
 * rejected historical recipes back into Discovery.
 */
export function isRetiredDiscoverSeedCard(card: {
  id?: string | null;
  authorId?: string | null;
  creatorId?: string | null;
  sourceName?: string | null;
  creatorName?: string | null;
  contentOrigin?: string | null;
  feedSource?: string | null;
}): boolean {
  const id = card.id ?? null;
  if (id && CURRENT_SEED_RECIPE_IDS.has(id)) return false;
  if (isSeedRecipeId(id)) return true;

  const attribution = (card.sourceName ?? card.creatorName ?? "")
    .trim()
    .toLowerCase();
  const isPlatformKitchen =
    attribution === "suppr kitchen" || attribution === "sloe kitchen";
  const isUnauthored = !card.authorId && !card.creatorId;
  const isFirstParty =
    card.contentOrigin == null || card.contentOrigin === "first_party";

  return (
    card.feedSource === "catalog" ||
    (isPlatformKitchen && isUnauthored && isFirstParty)
  );
}

export function findSeedRecipeById(id: string): SeedRecipe | null {
  return SEED_RECIPES_V2.find((recipe) => recipe.id === id) ?? null;
}

export function getSeedRecipesByCluster(
  cluster: SeedCuisineCluster,
): ReadonlyArray<SeedRecipe> {
  return SEED_RECIPES_V2.filter((recipe) => recipe.cluster === cluster);
}

/** Canonical Discover carousel reading order for the approved collection. */
export const SEED_CLUSTERS: ReadonlyArray<{
  id: SeedCuisineCluster;
  title: string;
  description: string;
}> = [
  {
    id: "mediterranean",
    title: "Mediterranean",
    description: "Sunlit plates, beans, herbs and seafood.",
  },
  {
    id: "asian",
    title: "East & Southeast Asian",
    description: "Noodles, rice bowls, curries and savoury depth.",
  },
  {
    id: "latin",
    title: "Mexican-inspired",
    description: "Eggs, beans, chilli and generous rice bowls.",
  },
];
