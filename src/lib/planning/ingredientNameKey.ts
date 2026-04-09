/**
 * Normalizes an ingredient display name so variants ("Chicken breast, skinless" vs "chicken breast")
 * group together for shopping display and plan overlap logic.
 */
export function normalizeIngredientNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(",")[0]!
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
