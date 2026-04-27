/**
 * B5 Phase 2b (2026-04-27) — cuisine normaliser.
 *
 * Maps freeform cuisine strings (from `recipes.tags`, `source_name`,
 * or recipe title heuristics) into the finite CUISINE_OPTIONS set the
 * Discover filter sheet shows.
 *
 * Returns null when no rule matches — caller writes null to
 * `recipes.cuisine` and the row is excluded from cuisine-filtered
 * results until a future backfill or a user manually re-classifies it.
 *
 * Spec: docs/specs/2026-04-27-b5-discover-phase2.md
 */

import type { CuisineOption } from "../discover/filterRecipes";

/**
 * Lowercase keyword → cuisine option. Order matters: more specific
 * terms first so "moroccan" maps to middle-eastern, not other.
 */
const KEYWORD_TO_CUISINE: ReadonlyArray<readonly [RegExp, CuisineOption]> = [
  [/\b(italian|pastas?|spaghetti|risotto|lasagn[ae]|pizzas?|carbonara|bolognese|gnocchi|tiramisu|focaccia|pesto|ravioli|cannelloni)\b/i, "italian"],
  [/\b(asian|chinese|japanese|korean|thai|vietnamese|sushi|ramen|pho|stir[- ]fry|udon|kimchi|teriyaki|miso|bibimbap|pad[- ]thai|noodles?|dim[- ]sum|tofu)\b/i, "asian"],
  [/\b(mediterranean|greek|cypriot|tzatziki|feta|hummus|falafel|spanakopita|moussaka|tabb?ouleh)\b/i, "mediterranean"],
  [/\b(mexican|tex[- ]mex|burritos?|tacos?|quesadillas?|fajitas?|guacamole|enchiladas?|tortillas?|salsa|chimichangas?|huevos[- ]rancheros)\b/i, "mexican"],
  [/\b(indian|curr(?:y|ies)|tikka|masala|biryani|naan|samosas?|dal|paneer|tandoori|chana)\b/i, "indian"],
  [/\b(american|burgers?|bbq|barbecue|mac[- ]and[- ]cheese|meatloaf|cornbread|pancakes|waffles|grits|gumbo|jambalaya)\b/i, "american"],
  [/\b(middle[- ]eastern|moroccan|lebanese|persian|iranian|turkish|shawarma|kebabs?|tagines?|baba[- ]ghanoush|harissa|kibbeh|fattoush)\b/i, "middle-eastern"],
];

/**
 * Normalise a cuisine string from freeform input.
 *
 * Inputs the helper handles:
 *   - the recipe title (e.g. "Spaghetti Carbonara" → italian)
 *   - tags array values (e.g. "Italian", "Pasta", "Quick Dinner")
 *   - source_name (e.g. "Bon Appétit · Italian")
 *
 * Caller passes a single string; if classifying with multiple
 * candidates, call once per candidate and keep the first non-null
 * result.
 */
export function normalizeCuisine(input: string | null | undefined): CuisineOption | null {
  if (!input) return null;
  const text = String(input);
  for (const [pattern, cuisine] of KEYWORD_TO_CUISINE) {
    if (pattern.test(text)) return cuisine;
  }
  return null;
}

/**
 * Helper: classify a recipe given its title + tag array. Returns the
 * first match across (title, then each tag). Used by the backfill
 * script and by the recipe-import path going forward.
 */
export function classifyRecipeCuisine(args: {
  title?: string | null;
  tags?: ReadonlyArray<string> | null;
  sourceName?: string | null;
}): CuisineOption | null {
  const fromTitle = normalizeCuisine(args.title);
  if (fromTitle) return fromTitle;
  for (const tag of args.tags ?? []) {
    const c = normalizeCuisine(tag);
    if (c) return c;
  }
  return normalizeCuisine(args.sourceName);
}
