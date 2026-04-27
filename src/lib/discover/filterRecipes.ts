/**
 * B5 Phase 2b (2026-04-27) — shared Discover filter library.
 *
 * Spec: docs/specs/2026-04-27-b5-discover-phase2.md
 *
 * Pure helpers consumed by both web (FilterSheet drawer) and mobile
 * (FilterSheet bottom sheet). Web + mobile feed both pass through
 * `applyDiscoverFilters` so filter semantics are byte-identical.
 *
 * The cuisine list + dietary preset list are intentionally finite —
 * we want the filter sheet to show a stable set of options rather
 * than mining every distinct value out of the live data. New
 * categories require a code + design pass, not a database row.
 */

export const CUISINE_OPTIONS = [
  "italian",
  "asian",
  "mediterranean",
  "mexican",
  "indian",
  "american",
  "middle-eastern",
  "other",
] as const;
export type CuisineOption = (typeof CUISINE_OPTIONS)[number];

export const COOK_TIME_BUCKETS = [
  { id: "≤15", maxMin: 15, label: "≤ 15 min" },
  { id: "≤30", maxMin: 30, label: "≤ 30 min" },
  { id: "≤45", maxMin: 45, label: "≤ 45 min" },
  { id: "≤60", maxMin: 60, label: "≤ 60 min" },
  { id: "60+", maxMin: null, label: "60+ min" },
] as const;
export type CookTimeBucketId = (typeof COOK_TIME_BUCKETS)[number]["id"];

export const DIETARY_PRESETS = [
  "vegan",
  "vegetarian",
  "gluten-free",
  "dairy-free",
  "high-protein",
  "keto",
  "paleo",
  "low-fodmap",
] as const;
export type DietaryPreset = (typeof DIETARY_PRESETS)[number];

export interface DiscoverFilters {
  /** Selected cuisines. Empty = no cuisine filter applied. */
  cuisines: ReadonlyArray<CuisineOption>;
  /** Selected cook-time bucket ids. Empty = no time filter applied. */
  cookTimes: ReadonlyArray<CookTimeBucketId>;
  /** Selected dietary presets. Empty = no dietary filter applied. */
  dietary: ReadonlyArray<DietaryPreset>;
}

export const EMPTY_FILTERS: DiscoverFilters = {
  cuisines: [],
  cookTimes: [],
  dietary: [],
};

/** Subset of recipe fields the filter reads. */
export interface FilterableRecipe {
  cuisine?: string | null;
  cookTimeMin?: number | null;
  dietaryFlags?: ReadonlyArray<string> | null;
}

/**
 * Apply the filter set to a single recipe row. Returns true when the
 * row should appear under the active filters. AND-semantics across
 * dimensions, OR-semantics within each dimension (multi-select).
 *
 * Filter rules:
 *   - cuisines: row.cuisine must be in the selected set. NULL cuisine
 *     row is excluded once any cuisine is selected.
 *   - cookTimes: at least one selected bucket must include the row's
 *     cookTimeMin. Bucket "60+" matches rows with cookTimeMin > 60
 *     OR a null cookTimeMin (treating "no time tag" as long).
 *   - dietary: row.dietaryFlags must contain ALL selected presets
 *     (high-protein + keto = both required, not either). This is
 *     stricter than cuisines/cookTimes because dietary presets
 *     stack rather than alternate.
 *
 * Empty filter sets short-circuit to true — same behaviour as no
 * filter applied.
 */
export function passesDiscoverFilters(
  recipe: FilterableRecipe,
  filters: DiscoverFilters,
): boolean {
  if (filters.cuisines.length > 0) {
    const c = recipe.cuisine?.toLowerCase() ?? null;
    if (!c || !filters.cuisines.includes(c as CuisineOption)) return false;
  }

  if (filters.cookTimes.length > 0) {
    const m = typeof recipe.cookTimeMin === "number" ? recipe.cookTimeMin : null;
    let anyBucket = false;
    for (const id of filters.cookTimes) {
      const bucket = COOK_TIME_BUCKETS.find((b) => b.id === id);
      if (!bucket) continue;
      if (bucket.maxMin == null) {
        // 60+ — matches rows >60 OR null (no tag = treated as long).
        if (m == null || m > 60) {
          anyBucket = true;
          break;
        }
      } else {
        if (m != null && m <= bucket.maxMin) {
          anyBucket = true;
          break;
        }
      }
    }
    if (!anyBucket) return false;
  }

  if (filters.dietary.length > 0) {
    const flags = (recipe.dietaryFlags ?? []).map((f) => f.toLowerCase());
    for (const preset of filters.dietary) {
      if (!flags.includes(preset)) return false;
    }
  }

  return true;
}

/** Convenience: filter an array. */
export function applyDiscoverFilters<T extends FilterableRecipe>(
  recipes: ReadonlyArray<T>,
  filters: DiscoverFilters,
): T[] {
  return recipes.filter((r) => passesDiscoverFilters(r, filters));
}

/** Returns true when no filters are applied. */
export function filtersAreEmpty(filters: DiscoverFilters): boolean {
  return (
    filters.cuisines.length === 0 &&
    filters.cookTimes.length === 0 &&
    filters.dietary.length === 0
  );
}

/**
 * Total number of applied filter chips — used by the "Filters (N)"
 * button label so the user can see at-a-glance how many active filters
 * are constraining the feed.
 */
export function countAppliedFilters(filters: DiscoverFilters): number {
  return filters.cuisines.length + filters.cookTimes.length + filters.dietary.length;
}
