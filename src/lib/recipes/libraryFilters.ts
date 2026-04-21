/**
 * Pure predicates for Library filter pills.
 *
 * Ported from the 2026-04-19 Claude Design prototype, which exposes
 * five pills in a single horizontal scroll row:
 *
 *   All · Saved · High-Protein · Quick · Vegetarian
 *
 * The `Saved` pill already exists as an entry-kind filter (Pass 6,
 * 2026-04-18). This module adds the three nutrition/time/diet pills
 * so web and mobile can share the same classification logic.
 *
 * Data notes
 * ----------
 *   - `High-Protein` and `Quick` run purely off `RecipeCard` fields
 *     already present on both platforms (`protein`, `prepTimeMin`,
 *     `cookTimeMin`).
 *   - `Vegetarian` is currently a title-heuristic because the
 *     `recipes` row doesn't carry a structured `dietary` array yet
 *     (see `src/types/recipe.ts`). The heuristic rejects obvious meat
 *     / fish keywords rather than asserting "vegetarian" from
 *     whole-cloth — false-positives on "vegetarian chicken" strings
 *     are tolerated because the pill is a _filter_, not a nutrition
 *     claim. Structured dietary tags land in a later schema pass
 *     (`recipes.dietary_tags`), at which point this file should prefer
 *     the structured signal and fall back to the heuristic.
 *
 * Thresholds
 * ----------
 *   - `HIGH_PROTEIN_G` = 25 g per serving. Matches the UX convention
 *     used elsewhere (Discover's "High protein" pill + onboarding
 *     strategy `protein-focused`).
 *   - `QUICK_TOTAL_MIN` = 30 min total (prep + cook). Matches the
 *     "Quick" label used on Discover.
 */

// Narrow shape — only the fields any filter needs. Both
// `src/types/recipe.ts` and `apps/mobile/lib/types.ts` are structural
// supersets, so both RecipeCard shapes satisfy this without a cast.
export type LibraryFilterRecipe = {
  title: string;
  protein: number;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
};

export const HIGH_PROTEIN_G = 25;
export const QUICK_TOTAL_MIN = 30;

/** `true` when the recipe has ≥ HIGH_PROTEIN_G grams of protein per serving. */
export function isHighProtein(r: LibraryFilterRecipe): boolean {
  return Number.isFinite(r.protein) && r.protein >= HIGH_PROTEIN_G;
}

/**
 * `true` when prep + cook ≤ QUICK_TOTAL_MIN minutes.
 * Missing times are treated as 0 (a recipe with no time metadata
 * isn't penalised — if the total is still ≤ 30, it qualifies).
 */
export function isQuick(r: LibraryFilterRecipe): boolean {
  const prep = typeof r.prepTimeMin === "number" && Number.isFinite(r.prepTimeMin) ? r.prepTimeMin : 0;
  const cook = typeof r.cookTimeMin === "number" && Number.isFinite(r.cookTimeMin) ? r.cookTimeMin : 0;
  // A recipe with neither field doesn't qualify — we'd otherwise flag
  // every legacy row as Quick. Require at least one signal.
  if (prep === 0 && cook === 0) return false;
  return prep + cook <= QUICK_TOTAL_MIN;
}

/**
 * Case-insensitive word-boundary keywords that force a recipe OUT of
 * the Vegetarian bucket. Errs on the side of exclusion — "chicken
 * stock" is excluded, "paneer" is included, etc.
 */
const NON_VEG_KEYWORDS: readonly RegExp[] = [
  /\bchicken\b/i,
  /\bturkey\b/i,
  /\bduck\b/i,
  /\bbeef\b/i,
  /\bsteak\b/i,
  /\bpork\b/i,
  /\bbacon\b/i,
  /\bham\b/i,
  /\bsausage\b/i,
  /\bmeatball/i,
  /\blamb\b/i,
  /\bveal\b/i,
  /\bfish\b/i,
  /\bsalmon\b/i,
  /\btuna\b/i,
  /\bcod\b/i,
  /\bprawn/i,
  /\bshrimp\b/i,
  /\bcrab\b/i,
  /\blobster\b/i,
  /\bmussel/i,
  /\banchov/i,
  /\boyster/i,
  /\bsquid\b/i,
  /\bcalamari\b/i,
  /\bchorizo\b/i,
  /\bpepperoni\b/i,
  /\bpancetta\b/i,
  /\bprosciutto\b/i,
];

/**
 * `true` when the recipe title contains no obvious meat/fish keyword.
 * Heuristic — see file header for rationale. Prefer structured
 * `dietary` tags when they land.
 */
export function isVegetarianByTitle(r: LibraryFilterRecipe): boolean {
  const t = (r.title ?? "").toLowerCase();
  if (!t.trim()) return false;
  return !NON_VEG_KEYWORDS.some((re) => re.test(t));
}

/** Pill identifiers shared across platforms. */
export type LibraryFilterPillId =
  | "all"
  | "saved"
  | "created"
  | "imported"
  | "high-protein"
  | "quick"
  | "vegetarian";

export type LibraryFilterPill = {
  id: LibraryFilterPillId;
  label: string;
  /** `true` when the pill maps to an entry-kind test (handled upstream). */
  isEntryKind: boolean;
};

/**
 * Canonical pill ordering for the horizontal scroll row. Order comes
 * straight from the prototype (All · Saved · High-Protein · Quick ·
 * Vegetarian) with Created / Imported preserved _after_ the prototype
 * set so the pre-Pass-6 entry-kind functionality stays reachable.
 * Both platforms should render this list directly rather than
 * re-defining it locally.
 */
export const LIBRARY_FILTER_PILLS: ReadonlyArray<LibraryFilterPill> = [
  { id: "all", label: "All", isEntryKind: true },
  { id: "saved", label: "Saved", isEntryKind: true },
  { id: "high-protein", label: "High-Protein", isEntryKind: false },
  { id: "quick", label: "Quick", isEntryKind: false },
  { id: "vegetarian", label: "Vegetarian", isEntryKind: false },
  { id: "created", label: "Created", isEntryKind: true },
  { id: "imported", label: "Imported", isEntryKind: true },
] as const;

/**
 * Pure predicate the two Library surfaces call for the three
 * non-entry-kind pills (High-Protein / Quick / Vegetarian). Entry-kind
 * filtering stays in the caller since it needs the user id and the
 * entry-kind-map from AppDataContext (web) or the authorId-derived
 * kind (mobile).
 */
export function matchesNutritionPill(
  pill: LibraryFilterPillId,
  recipe: LibraryFilterRecipe,
): boolean {
  switch (pill) {
    case "high-protein":
      return isHighProtein(recipe);
    case "quick":
      return isQuick(recipe);
    case "vegetarian":
      return isVegetarianByTitle(recipe);
    default:
      // Entry-kind pills ("all" / "saved" / "created" / "imported")
      // aren't handled here — caller short-circuits with `true` so the
      // pipeline keeps every row.
      return true;
  }
}
