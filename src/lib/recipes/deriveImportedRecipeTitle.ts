/**
 * Imported-recipe title fallback chain (ENG-1047).
 *
 * Shared by the web import route (`app/api/recipe-import/route.ts`, which
 * returns the title to both web AND mobile clients) and the mobile save path
 * (`apps/mobile/lib/saveImportedRecipe.ts`). Keeping the chain in one place
 * means an untitled import gets the same derived title on both platforms.
 *
 * The chain, in order:
 *   1. the caller's already-sanitised title — `sanitiseImportedTitle` on web,
 *      `normalizeRecipeTitle` on mobile — when it yielded a real title;
 *   2. the first NON-generic ingredient's food name (e.g. "Beef chuck");
 *   3. the source domain's brand label (e.g. "allrecipes.com" → "Allrecipes");
 *   4. "Imported recipe" — the final, generic default.
 *
 * Pass `sanitizedTitle: null` when your sanitiser reports no usable title.
 * Deterministic: no external calls, no USDA lookup, no user input.
 */
import { parseIngredientLine } from "../recipe-ingredients/parseIngredientLine";

export const IMPORTED_RECIPE_FALLBACK_TITLE = "Imported recipe";

/**
 * Ingredient head-words too vague to title a recipe — the staples that often
 * lead a list ("salt to taste", "1 tbsp oil", "2 cloves garlic"). A candidate
 * is skipped when its FIRST word is one of these (so generic-led lines are
 * dropped); we then try the next ingredient, then the domain, then the generic
 * default. A generic-led-but-specific line ("onion soup base") is skipped too —
 * harmless, it just falls through to the next candidate.
 */
const GENERIC_INGREDIENT_WORDS = new Set([
  "salt",
  "water",
  "oil",
  "sugar",
  "pepper",
  "onion",
  "garlic",
  "butter",
  "egg",
  "flour",
]);

/**
 * Public-suffix labels that are never a brand. Guards the `.co.uk` / `.com.au`
 * shape (second-to-last label is "co"/"com", not the brand) — we return null so
 * the caller falls through to the generic default rather than titling a recipe
 * "Co".
 */
const GENERIC_DOMAIN_LABELS = new Set(["co", "com", "org", "net", "www", "gov", "edu", "ac"]);

/** Capitalise the first letter only — keeps multi-word food names readable
 *  ("chicken breast" → "Chicken breast") without inventing word boundaries. */
function capitaliseFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * First non-generic ingredient's food name, title-cased — or null if none
 * qualify. Uses `parseIngredientLine` to drop the quantity/unit so the title
 * reads as the food ("Chicken breast"), not the raw line ("200 g chicken
 * breast"). Requires >3 chars so "ham"/"egg"-length scraps don't title a dish.
 */
export function deriveRecipeTitleFromIngredients(
  ingredients: readonly string[] | null | undefined,
): string | null {
  if (!ingredients) return null;
  for (const raw of ingredients) {
    if (typeof raw !== "string") continue;
    const name = parseIngredientLine(raw).name.trim();
    if (name.length <= 3) continue;
    const firstWord = name.toLowerCase().split(/\s+/)[0] ?? "";
    if (GENERIC_INGREDIENT_WORDS.has(firstWord)) continue;
    return capitaliseFirst(name);
  }
  return null;
}

/**
 * Brand label from a source URL's second-level domain, title-cased — or null.
 *   "https://allrecipes.com/..." → "Allrecipes"
 *   "https://food.com/..."       → "Food"
 *   "https://mail.google.com/.." → "Google"  (SLD, not the subdomain)
 *   "https://x.co.uk/..."        → null       (SLD label is "co")
 */
export function deriveTitleFromSourceDomain(
  sourceUrl: string | null | undefined,
): string | null {
  if (!sourceUrl) return null;
  let host: string;
  try {
    host = new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return null;
  const sld = labels[labels.length - 2]!.toLowerCase();
  if (sld.length < 2 || GENERIC_DOMAIN_LABELS.has(sld)) return null;
  return capitaliseFirst(sld);
}

/**
 * Best display title for an imported recipe. See the file header for the chain.
 */
export function deriveImportedRecipeTitle(args: {
  /** The caller's sanitised title, or null when the sanitiser found none. */
  sanitizedTitle: string | null | undefined;
  ingredients?: readonly string[] | null;
  sourceUrl?: string | null;
}): string {
  const { sanitizedTitle, ingredients, sourceUrl } = args;
  if (sanitizedTitle && sanitizedTitle.trim()) return sanitizedTitle.trim();
  return (
    deriveRecipeTitleFromIngredients(ingredients) ??
    deriveTitleFromSourceDomain(sourceUrl) ??
    IMPORTED_RECIPE_FALLBACK_TITLE
  );
}
