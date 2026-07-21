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
 *   - `Vegetarian` is a layered predicate (GW-02 fix, 2026-04-28).
 *     Pre-fix it was a title-only heuristic that whitelisted "Pasta
 *     Bolognese", "Curry", "Lasagne", etc. — every dish whose meat
 *     wasn't in the title slipped through. Layers, in priority order:
 *
 *       1. Structured `dietaryFlags` (`recipes.dietary_flags` jsonb,
 *          per `supabase/migrations/20260503105000_recipes_cuisine_dietary_flags.sql`).
 *          When the recipe has been classified as `vegan` or
 *          `vegetarian`, we trust it.
 *       2. Allergen array (`recipes.allergens` text[]). If the row
 *          contains any of `fish`, `crustaceans`, `molluscs` we
 *          short-circuit to NOT vegetarian regardless of title — the
 *          allergen tagger walked the ingredient list and found
 *          something a vegetarian wouldn't eat.
 *       3. Title keyword scan (the legacy heuristic, expanded to
 *          cover common dishes that don't name the meat directly:
 *          bolognese, carbonara, schnitzel, kebab, gyro, paella…).
 *       4. Fall back: `true` (we don't have a strong negative signal
 *          and the user can verify ingredients).
 *
 *     Errs on the side of EXCLUSION when any layer flags meat / fish.
 *     False-negatives ("Mushroom Bolognese" gets dropped) are easier
 *     to live with than false-positives ("Beef Lasagne" sneaks in).
 *
 * Thresholds
 * ----------
 *   - `HIGH_PROTEIN_G` = 25 g per serving. Matches the UX convention
 *     used elsewhere (Discover's "High protein" pill + onboarding
 *     strategy `protein-focused`).
 *   - `QUICK_TOTAL_MIN` = 30 min total (prep + cook). Matches the
 *     "Quick" label used on Discover.
 */
import { totalRecipeDurationMin } from "./totalDuration";

// Narrow shape — only the fields any filter needs. Both
// `src/types/recipe.ts` and `apps/mobile/lib/types.ts` are structural
// supersets, so both RecipeCard shapes satisfy this without a cast.
export type LibraryFilterRecipe = {
  title: string;
  protein: number;
  prepTimeMin?: number | null;
  cookTimeMin?: number | null;
  /**
   * Optional regulated-allergen slugs from
   * `src/constants/regulatedAllergens.ts`. Used by the Vegetarian
   * filter to short-circuit when any meat/fish allergen is present.
   * Empty array / undefined = no signal (don't draw a conclusion).
   */
  allergens?: readonly string[] | null;
  /**
   * Optional dietary preset tags from `recipes.dietary_flags`. Values
   * include `"vegan" | "vegetarian" | "gluten-free" | "dairy-free" |
   * "high-protein" | "keto" | "paleo" | "low-fodmap"`. When present
   * we trust the structured signal over the title heuristic.
   */
  dietaryFlags?: readonly string[] | null;
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
  // ENG-1617 — one shared total (prep + cook) selector. A recipe with
  // neither field doesn't qualify (null) — we'd otherwise flag every
  // legacy row as Quick. Require at least one real signal.
  const total = totalRecipeDurationMin(r.prepTimeMin, r.cookTimeMin);
  return total != null && total <= QUICK_TOTAL_MIN;
}

/**
 * Case-insensitive word-boundary keywords that force a recipe OUT of
 * the Vegetarian bucket. Errs on the side of exclusion — "chicken
 * stock" is excluded, "paneer" is included, etc.
 *
 * GW-02 expansion (2026-04-28): added common dishes whose name
 * doesn't include the meat word ("bolognese", "carbonara", "kebab",
 * "schnitzel", "gyro", "paella", "biryani", "pulled" + meat-implying
 * descriptors), plus more cuts ("ribs", "brisket", "mince",
 * "meatloaf"), plus more fish/seafood ("haddock", "halibut",
 * "mackerel", "trout", "scallop", "octopus"). The list is still not
 * exhaustive — the structured `dietaryFlags` + `allergens` checks
 * (see `isVegetarian` below) are the load-bearing signals; this
 * keyword scan is the fallback.
 */
const NON_VEG_KEYWORDS: readonly RegExp[] = [
  // Poultry
  /\bchicken\b/i,
  /\bturkey\b/i,
  /\bduck\b/i,
  /\bgoose\b/i,
  /\bquail\b/i,
  // Red meat — cuts + descriptors
  /\bbeef\b/i,
  /\bsteak\b/i,
  /\bbrisket\b/i,
  /\bribs?\b/i,
  /\bmince\b/i,
  /\bmeatloaf/i,
  /\bmeatball/i,
  /\bpork\b/i,
  /\bbacon\b/i,
  /\bham\b/i,
  /\bgammon\b/i,
  /\bsausage\b/i,
  /\bhot ?dog/i,
  /\blamb\b/i,
  /\bmutton\b/i,
  /\bveal\b/i,
  /\bvenison\b/i,
  /\boxtail\b/i,
  /\bliver\b/i,
  /\bkidney(?!\s*bean)/i, // "kidney bean" stays vegetarian
  // Cured / charcuterie
  /\bchorizo\b/i,
  /\bpepperoni\b/i,
  /\bpancetta\b/i,
  /\bprosciutto\b/i,
  /\bsalami\b/i,
  /\bmortadella\b/i,
  /\bcorned beef\b/i,
  // Common dishes that imply meat
  /\bbolognese\b/i,
  /\bcarbonara\b/i,
  /\blasagn[ae]\b/i,
  /\bkebab\b/i,
  /\bgyro\b/i,
  /\bschnitzel\b/i,
  /\bparmig?iana\b/i, // chicken parm
  /\bpaella\b/i,
  /\bbiryani\b/i,
  /\bbourguignon\b/i,
  /\bstroganoff\b/i,
  /\bgoulash\b/i,
  /\bchili con carne\b/i,
  /\btikka masala\b/i, // canonical chicken dish — false-negative on paneer tikka acceptable
  /\bfajita/i, // canonical chicken/beef/shrimp; false-negative on veg fajita acceptable
  /\bpulled (pork|beef|chicken|lamb)\b/i,
  // Fish
  /\bfish\b/i,
  /\bsalmon\b/i,
  /\btuna\b/i,
  /\bcod\b/i,
  /\bhaddock\b/i,
  /\bhalibut\b/i,
  /\bmackerel\b/i,
  /\bsardine/i,
  /\btrout\b/i,
  /\bbass\b/i,
  /\bsnapper\b/i,
  /\btilapia\b/i,
  /\bswordfish\b/i,
  /\bcatfish\b/i,
  // Shellfish / cephalopods
  /\bprawn/i,
  /\bshrimp\b/i,
  /\bcrab\b/i,
  /\blobster\b/i,
  /\bmussel/i,
  /\banchov/i,
  /\boyster/i,
  /\bclam\b/i,
  /\bsquid\b/i,
  /\bcalamari\b/i,
  /\bscallop/i,
  /\boctopus\b/i,
];

/** Lowercase set of allergen slugs that disqualify a recipe from "vegetarian". */
const NON_VEG_ALLERGEN_SLUGS = new Set(["fish", "crustaceans", "molluscs"]);

/**
 * `true` when the recipe title contains no obvious meat/fish keyword.
 * Heuristic — see file header for rationale. Now layered behind
 * structured signals (`dietaryFlags`, `allergens`) when those are
 * available — see `isVegetarian` below. Kept exported so existing
 * callers / tests that pin the title-only behaviour still resolve.
 */
export function isVegetarianByTitle(r: LibraryFilterRecipe): boolean {
  const t = (r.title ?? "").toLowerCase();
  if (!t.trim()) return false;
  return !NON_VEG_KEYWORDS.some((re) => re.test(t));
}

/**
 * Layered Vegetarian predicate (GW-02 fix, 2026-04-28).
 *
 *   1. Trust `dietaryFlags` when present — `vegan` or `vegetarian`
 *      tags ⇒ vegetarian; explicit absence (empty / non-veg
 *      classifier) doesn't decide either way (we still scan further).
 *   2. Reject if `allergens` contains `fish` / `crustaceans` /
 *      `molluscs` — those slugs are populated by
 *      `inferAllergensFromIngredients`, so this is an ingredient-
 *      derived signal even though the column is intended for
 *      regulated-allergen disclosure.
 *   3. Fall back to the title keyword scan.
 */
export function isVegetarian(r: LibraryFilterRecipe): boolean {
  const flags = Array.isArray(r.dietaryFlags) ? r.dietaryFlags : null;
  if (flags) {
    const lc = flags.map((f) => String(f).toLowerCase());
    if (lc.includes("vegan") || lc.includes("vegetarian")) return true;
  }
  const allergens = Array.isArray(r.allergens) ? r.allergens : null;
  if (allergens) {
    for (const a of allergens) {
      if (NON_VEG_ALLERGEN_SLUGS.has(String(a).toLowerCase())) return false;
    }
  }
  return isVegetarianByTitle(r);
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
      return isVegetarian(recipe);
    default:
      // Entry-kind pills ("all" / "saved" / "created" / "imported")
      // aren't handled here — caller short-circuits with `true` so the
      // pipeline keeps every row.
      return true;
  }
}
