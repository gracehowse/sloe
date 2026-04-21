/** Web app URL that opens Discover with a recipe (share / deep link). */
export function webRecipeDeepLink(recipeId: string, origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/home?view=discover&recipe=${encodeURIComponent(recipeId)}`;
}
