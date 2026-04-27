/**
 * recipeSearchMatch (2026-04-25 polish)
 *
 * Tester feedback: searching "wasabi katsu curry" returned no results, but
 * searching just "katsu curry" did. Wasabi is a restaurant brand prefix that
 * doesn't appear contiguously in the recipe title — pre-fix, the matcher used
 * `title.toLowerCase().includes(query.toLowerCase())`, which requires the
 * exact substring (token order and contiguity).
 *
 * Fix: tokenize the query, require every non-trivial token to appear somewhere
 * in the haystack (title + description + creator + source). Token order
 * doesn't matter; punctuation is stripped; case is folded. This is what users
 * expect from "search" as a feature.
 *
 * Returns true when the recipe matches the query. Empty / whitespace-only
 * queries always match (caller should typically short-circuit before calling).
 *
 * Pinned by tests/unit/recipeSearchMatch.test.ts.
 */

export interface RecipeSearchHaystack {
  title?: string | null;
  description?: string | null;
  creatorName?: string | null;
  source?: string | null;
  /** Optional pre-flattened tag/category list (e.g. mealType array). */
  tags?: readonly string[] | null;
}

// Apostrophes and curly quotes — strip without leaving a gap so "Mom's"
// becomes "moms", matching the way users typically type the search query.
const APOSTROPHE_RE = /[‘’ʼ']/g;
// All other punctuation → whitespace so "wasabi, katsu" tokenises cleanly.
const PUNCT_RE = /[^\p{L}\p{N}\s]/gu;

function normalizeForSearch(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(APOSTROPHE_RE, "")
    .replace(PUNCT_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(query: string): string[] {
  return normalizeForSearch(query)
    .split(" ")
    .filter((t) => t.length > 0);
}

export function recipeSearchMatch(
  recipe: RecipeSearchHaystack,
  query: string,
): boolean {
  const tokens = tokenize(query);
  if (tokens.length === 0) return true;

  const fields = [
    normalizeForSearch(recipe.title),
    normalizeForSearch(recipe.description),
    normalizeForSearch(recipe.creatorName),
    normalizeForSearch(recipe.source),
    normalizeForSearch((recipe.tags ?? []).join(" ")),
  ];
  const haystack = fields.filter((f) => f.length > 0).join(" ");
  if (!haystack) return false;

  // Every token must appear somewhere in the joined haystack. Token order
  // doesn't matter (so "katsu curry wasabi" and "wasabi katsu curry" both
  // match a "Katsu Curry · Wasabi" recipe).
  return tokens.every((tok) => haystack.includes(tok));
}
