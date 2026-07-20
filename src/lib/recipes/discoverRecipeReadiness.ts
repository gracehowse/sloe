import { isRetiredStockImageUrl } from "./heroImageFallback";

/**
 * Minimum card shape needed to decide whether a recipe is polished enough for
 * the public Discover catalogue. Library deliberately does not use this gate:
 * a person's own incomplete draft/import must remain recoverable there.
 */
export interface DiscoverRecipeReadinessInput {
  title?: string | null;
  image?: string | null;
  servings?: number | string | null;
  calories?: number | string | null;
  protein?: number | string | null;
  carbs?: number | string | null;
  fat?: number | string | null;
  prepTimeMin?: number | string | null;
  cookTimeMin?: number | string | null;
  prepTime?: string | null;
  cookTime?: string | null;
}

const PLACEHOLDER_TITLES: ReadonlySet<string> = new Set([
  "recipe",
  "unknown",
  "unknown recipe",
  "unavailable",
  "untitled",
  "untitled recipe",
]);

function finiteNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasPositiveDuration(
  minutes: number | string | null | undefined,
  label: string | null | undefined,
): boolean {
  const numericMinutes = finiteNumber(minutes);
  if (numericMinutes != null && numericMinutes > 0) return true;

  if (typeof label !== "string") return false;
  const amount = label.trim().match(/\d+(?:\.\d+)?/)?.[0];
  return amount != null && Number(amount) > 0;
}

/**
 * Public Discover is an editorial surface, not a recovery surface. Only admit
 * cards with a usable title, a real remote image, servings, nutrition, and at
 * least one positive prep/cook duration. This is shared by web and mobile so a
 * weak database row or stale offline-cache entry cannot leak onto one client.
 */
export function isDiscoverReadyRecipeCard(
  recipe: DiscoverRecipeReadinessInput,
): boolean {
  const title = typeof recipe.title === "string" ? recipe.title.trim() : "";
  if (title.length < 3 || PLACEHOLDER_TITLES.has(title.toLowerCase())) return false;

  const image = typeof recipe.image === "string" ? recipe.image.trim() : "";
  if (!/^https?:\/\/\S+$/i.test(image) || isRetiredStockImageUrl(image)) return false;

  const servings = finiteNumber(recipe.servings);
  const calories = finiteNumber(recipe.calories);
  const protein = finiteNumber(recipe.protein);
  const carbs = finiteNumber(recipe.carbs);
  const fat = finiteNumber(recipe.fat);

  if (servings == null || servings <= 0 || calories == null || calories <= 0) return false;
  if ([protein, carbs, fat].some((macro) => macro == null || macro < 0)) return false;

  return (
    hasPositiveDuration(recipe.prepTimeMin, recipe.prepTime) ||
    hasPositiveDuration(recipe.cookTimeMin, recipe.cookTime)
  );
}
