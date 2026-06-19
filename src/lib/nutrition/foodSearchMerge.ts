/**
 * Shared food-search merge/rank/dedup pipeline (ENG-1113).
 *
 * Pure and platform-agnostic: callers map vendor payloads into rows, then this
 * module applies the one canonical ordering, defensive filtering, per-source
 * dedupe, and confidence-tier stamping used by web and mobile.
 */
import {
  foodSearchRankScore,
  searchMatchScore,
  searchRowConfidenceTier,
  type FoodSearchTrustSource,
  type SearchRowConfidenceTier,
} from "./foodSearchRanking";
import {
  isBareGenericNounRow,
  isLowConfidenceDemotedRow,
  isLowRelevanceNonVerifiedRow,
} from "./searchRowTrust";

export type MergeableFoodSearchRow = {
  key: string;
  name: string;
  _source: FoodSearchTrustSource;
  verified?: boolean;
  confidenceTier?: SearchRowConfidenceTier;
};

export type RankedFoodSearchRow<T extends MergeableFoodSearchRow> = T & {
  _relevance: number;
  confidenceTier: SearchRowConfidenceTier;
};

function defaultDedupeKey(row: MergeableFoodSearchRow): string {
  if (row._source === "CUSTOM") return `custom:${row.key}`;
  if (row._source === "GenericBeverage" || row._source === "GenericFood") {
    return `generic:${row.key}`;
  }
  return `${row._source}|${row.name.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

export function rankFoodSearchRow<T extends MergeableFoodSearchRow>(
  query: string,
  row: T,
  recentlyLogged = false,
): T & { _relevance: number } {
  return {
    ...row,
    _relevance: foodSearchRankScore({
      query,
      name: row.name,
      source: row._source,
      verified: Boolean(row.verified),
      recentlyLogged,
    }),
  };
}

export function mergeFoodSearchRows<T extends MergeableFoodSearchRow>(input: {
  query: string;
  rows: readonly T[];
  limit?: number;
  dedupeKey?: (row: T) => string;
  recentlyLogged?: (row: T) => boolean;
}): Array<RankedFoodSearchRow<T>> {
  const { query, rows, limit = 25 } = input;
  const ranked = rows
    .map((row) => rankFoodSearchRow(query, row, input.recentlyLogged?.(row) ?? false))
    .sort((a, b) => b._relevance - a._relevance)
    .filter((row) => {
      const isVerified = Boolean(row.verified);
      if (isBareGenericNounRow(row.name, isVerified)) return false;
      if (isLowRelevanceNonVerifiedRow(row._relevance, isVerified)) return false;
      const tier = searchRowConfidenceTier({
        source: row._source,
        verified: isVerified,
        matchScore: searchMatchScore(query, row.name),
      });
      if (isLowConfidenceDemotedRow({ tier, score: row._relevance })) return false;
      return true;
    });

  const seen = new Set<string>();
  const out: Array<RankedFoodSearchRow<T>> = [];
  for (const row of ranked) {
    const key = input.dedupeKey?.(row) ?? defaultDedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...row,
      confidenceTier: searchRowConfidenceTier({
        source: row._source,
        verified: Boolean(row.verified),
        matchScore: searchMatchScore(query, row.name),
      }),
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function foodSearchSourceLabel(source: FoodSearchTrustSource): string {
  switch (source) {
    case "USDA":
      return "USDA";
    case "OFF":
      return "Open Food Facts";
    case "Edamam":
      return "Edamam";
    case "FatSecret":
      return "FatSecret";
    case "CUSTOM":
      return "Custom";
    case "GenericBeverage":
    case "GenericFood":
      return "Sloe";
    default:
      return String(source);
  }
}
