/**
 * Shared food-search ranking helpers (ENG-706).
 *
 * Web `FoodSearchPanel` and mobile `verifyRecipe.mergeResults` both rank
 * multi-source hits by token overlap + source trust weight. Keep the math
 * here so USDA/OFF/Edamam/FatSecret tie-breaks stay aligned.
 */

export type FoodSearchTrustSource =
  | "USDA"
  | "OFF"
  | "Edamam"
  | "FatSecret"
  | "CUSTOM"
  | "GenericBeverage"
  | "GenericFood"
  | string;

/** Word-overlap relevance in [0, 1], with a brevity tie-break. */
export function searchRelevance(query: string, name: string): number {
  const q = query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const n = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!q || !n) return 0;
  if (q === n) return 1;
  const qTokens = q.split(" ").filter(Boolean);
  const nTokens = new Set(n.split(" ").filter(Boolean));
  let hits = 0;
  for (const t of qTokens) if (nTokens.has(t)) hits++;
  const recall = hits / Math.max(1, qTokens.length);
  const brevity = Math.min(1, 4 / Math.max(1, nTokens.size));
  return recall * 0.7 + recall * brevity * 0.3;
}

/**
 * Source trust delta added to `searchRelevance` before sorting.
 * Verified USDA wins on tie; generic OFF rows demote hardest.
 */
export function foodSearchTrustWeight(input: {
  source: FoodSearchTrustSource;
  verified?: boolean;
  /** Display name — OFF brand detection uses the · separator. */
  name: string;
}): number {
  if (input.source === "USDA" && input.verified) return 0.10;
  if (input.source === "USDA") return -0.15;
  if (input.source === "Edamam") return -0.05;
  if (input.source === "FatSecret") return -0.05;
  if (input.source === "OFF") {
    const hasBrand = /·/.test(input.name);
    return hasBrand ? -0.10 : -0.20;
  }
  return 0;
}

/** Combined rank score used when sorting merged search rows. */
export function foodSearchRankScore(input: {
  query: string;
  name: string;
  source: FoodSearchTrustSource;
  verified?: boolean;
}): number {
  return Math.max(
    0,
    searchRelevance(input.query, input.name) +
      foodSearchTrustWeight({
        source: input.source,
        verified: input.verified,
        name: input.name,
      }),
  );
}
