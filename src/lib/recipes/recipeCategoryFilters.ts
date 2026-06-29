/**
 * Category filter pills for the Recipes surfaces (Library + Discover).
 *
 * ENG-921 (Grace decision, 2026-06-07): the Recipes filter row moves
 * from entry-kind pills (Saved / Imported / Created) to **category**
 * pills that match the Sloe Figma `527:2` (Cookbook) and `528:2`
 * (Discover) frames:
 *
 *   Library:  All · Breakfast · Lunch · Dinner · Dessert · Quick 30 ·
 *             Under 500 cal · High protein · Soup · Pasta · Chicken · Salad
 *   Discover: All · Trending · Quick 30 · Under 500 cal · High protein ·
 *             From Reels · Breakfast · Dinner · Dessert · Soup · Pasta · Chicken
 *
 * This module owns the pill SET + the pure predicate for each category.
 * It is shared between web (`Library.tsx`, `DiscoverFeed.tsx`) and
 * mobile (`(tabs)/library.tsx`, `(tabs)/discover.tsx`) so the two
 * platforms cannot drift on taxonomy or classification.
 *
 * Underlying filter logic is PRESERVED, not replaced:
 *   - `Quick 30`  reuses `isQuick` (≤ 30 min total) from `libraryFilters`.
 *   - `High protein` reuses `isHighProtein` (≥ 25 g) from `libraryFilters`.
 *   - `Under 500 cal` is a new calorie predicate (≤ 500 kcal/serving).
 *   - meal-type (`Breakfast`/`Lunch`/`Dinner`/`Dessert`) is LAYERED:
 *       1. structured `mealSlots` (`recipes` → RecipeCard.mealSlots) when present;
 *       2. title-keyword fallback (most imports carry no slot metadata,
 *          so a pure structured check would silently empty the pill).
 *   - dish keywords (`Soup`/`Pasta`/`Chicken`/`Salad`) are title-keyword
 *     predicates — they work on every row that has a title.
 *   - `Trending` / `From Reels` (Discover-only) map to existing signals
 *     (`savedCount` ≥ popular threshold; `sourcePlatform` is a social
 *     platform) — handled in the caller, not here, because they need
 *     Discover-only fields and thresholds the caller already imports.
 *
 * The entry-kind buckets (Saved / Imported / Created) are NOT removed —
 * they are preserved as a SECONDARY filter path in each screen (see
 * `entryKindForRecipe` in the screens + `classifyLibraryEntry`), so the
 * user can still narrow by how a recipe entered their library. Category
 * is the PRIMARY row per Figma.
 */

import { isHighProtein, isQuick, type LibraryFilterRecipe } from "./libraryFilters";

/** Canonical category identifiers. `all` is the no-op reset pill. */
export type RecipeCategoryId =
  | "all"
  // meal type
  | "breakfast"
  | "lunch"
  | "dinner"
  | "dessert"
  // nutrition / time
  | "quick"
  | "under-500"
  | "high-protein"
  // dish / ingredient
  | "soup"
  | "pasta"
  | "chicken"
  | "salad";

export type RecipeCategoryPill = {
  id: RecipeCategoryId;
  /** Figma label (sentence-case, British spelling where relevant). */
  label: string;
};

/** Discover-only category id — adds `trending` / `from-reels` signals. */
export type DiscoverCategoryId = RecipeCategoryId | "trending" | "from-reels";

export type DiscoverCategoryPill = {
  id: DiscoverCategoryId;
  label: string;
};

/**
 * Library category row — order straight from Figma `527:2`.
 * `All` first, then meal-type, then nutrition/time, then dish keywords.
 */
export const LIBRARY_CATEGORY_PILLS: ReadonlyArray<RecipeCategoryPill> = [
  { id: "all", label: "All" },
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "dessert", label: "Dessert" },
  { id: "quick", label: "Quick 30" },
  { id: "under-500", label: "Under 500 cal" },
  { id: "high-protein", label: "High protein" },
  { id: "soup", label: "Soup" },
  { id: "pasta", label: "Pasta" },
  { id: "chicken", label: "Chicken" },
  { id: "salad", label: "Salad" },
] as const;

/**
 * Discover category row — order straight from Figma `528:2`.
 * `Trending` + `From Reels` are Discover-only (community signals).
 */
export const DISCOVER_CATEGORY_PILLS: ReadonlyArray<DiscoverCategoryPill> = [
  { id: "all", label: "All" },
  { id: "trending", label: "Trending" },
  { id: "quick", label: "Quick 30" },
  { id: "under-500", label: "Under 500 cal" },
  { id: "high-protein", label: "High protein" },
  { id: "from-reels", label: "From Reels" },
  { id: "breakfast", label: "Breakfast" },
  { id: "dinner", label: "Dinner" },
  { id: "dessert", label: "Dessert" },
  { id: "soup", label: "Soup" },
  { id: "pasta", label: "Pasta" },
  { id: "chicken", label: "Chicken" },
] as const;

/**
 * Provenance row — the v3 prototype's Cookbook filter set (All / Saved /
 * Created / Imported). ENG-1247 (Grace, 2026-06-26 "Both rows") re-surfaces the
 * entry-kind buckets as a visible SECOND pill row above the category row,
 * knowingly reversing the ENG-921 "fold into a quiet cycle, not a competing
 * second row" polish (the Figma it matched is dead; the v3 prototype is
 * canonical). The classification stays `classifyLibraryEntry`
 * (`libraryEntryKind.ts`); `all` is the no-op reset. Shared web + mobile.
 */
export type RecipeProvenanceId = "all" | "saved" | "created" | "imported";

export type RecipeProvenancePill = { id: RecipeProvenanceId; label: string };

export const LIBRARY_PROVENANCE_PILLS: ReadonlyArray<RecipeProvenancePill> = [
  { id: "all", label: "All" },
  { id: "saved", label: "Saved" },
  { id: "created", label: "Created" },
  { id: "imported", label: "Imported" },
] as const;

/** `≤ UNDER_500_KCAL` kcal per serving qualifies for "Under 500 cal". */
export const UNDER_500_KCAL = 500;

/**
 * Shape any category predicate may read. Structural superset of both
 * `RecipeCard` types, so both platforms satisfy it without a cast.
 * Extends `LibraryFilterRecipe` so the reused `isQuick`/`isHighProtein`
 * predicates type-check directly.
 */
export type RecipeCategoryRecipe = LibraryFilterRecipe & {
  calories?: number | null;
  /** Planner slots from `recipes` (RecipeCard.mealSlots). */
  mealSlots?: readonly string[] | null;
};

/** Case-insensitive word-boundary keyword test against the title. */
function titleMatches(title: string | undefined, keywords: readonly RegExp[]): boolean {
  const t = (title ?? "").toLowerCase();
  if (!t.trim()) return false;
  return keywords.some((re) => re.test(t));
}

/** `true` when the recipe declares (or its title implies) the given slot. */
function hasMealSlot(recipe: RecipeCategoryRecipe, slot: string): boolean {
  const slots = Array.isArray(recipe.mealSlots) ? recipe.mealSlots : null;
  if (!slots) return false;
  return slots.some((s) => String(s).toLowerCase() === slot.toLowerCase());
}

const BREAKFAST_KEYWORDS: readonly RegExp[] = [
  /\boats?\b/i, /\boatmeal\b/i, /\bporridge\b/i, /\bgranola\b/i, /\bmuesli\b/i,
  /\bpancakes?\b/i, /\bwaffles?\b/i, /\bfrench toast\b/i, /\bomelett?es?\b/i,
  /\bfrittata\b/i, /\bscrambl/i, /\bshakshuka\b/i, /\bbreakfast\b/i,
  /\bsmoothie\b/i, /\bparfait\b/i, /\bchia pudding\b/i, /\bbagel\b/i,
  /\bcroissant\b/i, /\bbrunch\b/i, /\bavocado toast\b/i, /\beggs benedict\b/i,
];

const LUNCH_KEYWORDS: readonly RegExp[] = [
  /\blunch\b/i, /\bsandwich\b/i, /\bwrap\b/i, /\bpita\b/i, /\bbaguette\b/i,
  /\bbowl\b/i, /\bsalad\b/i, /\bgrain bowl\b/i, /\bburrito\b/i, /\bquesadilla\b/i,
  /\bpoke\b/i, /\btoast\b/i, /\bflatbread\b/i, /\bpanini\b/i,
];

const DINNER_KEYWORDS: readonly RegExp[] = [
  /\bdinner\b/i, /\bcurry\b/i, /\bstew\b/i, /\broast\b/i, /\bbake[d]?\b/i,
  /\bcasserole\b/i, /\bsteak\b/i, /\bsalmon\b/i, /\bpasta\b/i, /\brisotto\b/i,
  /\bstir.?fry\b/i, /\btacos?\b/i, /\bchili\b/i, /\bchilli\b/i, /\bramen\b/i,
  /\blasagn[ae]\b/i, /\btraybake\b/i, /\bsheet.?pan\b/i, /\bgnocchi\b/i,
  /\bschnitzel\b/i, /\bmeatballs?\b/i, /\bbolognese\b/i,
];

const DESSERT_KEYWORDS: readonly RegExp[] = [
  /\bdessert\b/i, /\bcake\b/i, /\bbrownie/i, /\bcookies?\b/i, /\bmuffins?\b/i,
  /\bpudding\b/i, /\bpie\b/i, /\btart\b/i, /\bcheesecake\b/i, /\bice cream\b/i,
  /\bsorbet\b/i, /\bmousse\b/i, /\bcrumble\b/i, /\bcobbler\b/i, /\bdoughnut/i,
  /\bdonut/i, /\bsundae\b/i, /\bcupcakes?\b/i, /\bbrûlée\b/i, /\bbrulee\b/i,
  /\bfudge\b/i, /\btruffle/i, /\bsweet treat\b/i,
];

const SOUP_KEYWORDS: readonly RegExp[] = [
  /\bsoup\b/i, /\bbroth\b/i, /\bbisque\b/i, /\bchowder\b/i, /\bramen\b/i,
  /\bcongee\b/i, /\bgazpacho\b/i, /\bminestrone\b/i, /\bpho\b/i, /\bstew\b/i,
];

const PASTA_KEYWORDS: readonly RegExp[] = [
  /\bpasta\b/i, /\bspaghetti\b/i, /\bpenne\b/i, /\bfusilli\b/i, /\blinguine\b/i,
  /\btagliatelle\b/i, /\bfettuccine\b/i, /\brigatoni\b/i, /\bmacaroni\b/i,
  /\blasagn[ae]\b/i, /\bcarbonara\b/i, /\bbolognese\b/i, /\borecchiette\b/i,
  /\bgnocchi\b/i, /\bravioli\b/i, /\bnoodles?\b/i, /\borzo\b/i,
];

const CHICKEN_KEYWORDS: readonly RegExp[] = [
  /\bchicken\b/i, /\bpoultry\b/i, /\bchook\b/i,
];

const SALAD_KEYWORDS: readonly RegExp[] = [
  /\bsalad\b/i, /\bslaw\b/i, /\btabbouleh\b/i, /\bfattoush\b/i, /\bcaprese\b/i,
  /\bnicoise\b/i, /\bcoleslaw\b/i,
];

/** Meal-type predicate — structured slot first, then title keyword. */
export function matchesMealType(
  recipe: RecipeCategoryRecipe,
  meal: "breakfast" | "lunch" | "dinner" | "dessert",
): boolean {
  switch (meal) {
    case "breakfast":
      return hasMealSlot(recipe, "Breakfast") || titleMatches(recipe.title, BREAKFAST_KEYWORDS);
    case "lunch":
      // No "Lunch" planner slot exists (slots are Breakfast/Lunch/Snacks/Dinner —
      // Lunch IS a slot); use it when present, else title keywords.
      return hasMealSlot(recipe, "Lunch") || titleMatches(recipe.title, LUNCH_KEYWORDS);
    case "dinner":
      return hasMealSlot(recipe, "Dinner") || titleMatches(recipe.title, DINNER_KEYWORDS);
    case "dessert":
      // No "Dessert" planner slot — dessert is title-keyword only.
      return titleMatches(recipe.title, DESSERT_KEYWORDS);
    default:
      return false;
  }
}

/** `true` when the recipe has ≤ UNDER_500_KCAL kcal per serving. */
export function isUnder500(recipe: RecipeCategoryRecipe): boolean {
  const kcal = typeof recipe.calories === "number" ? recipe.calories : NaN;
  return Number.isFinite(kcal) && kcal > 0 && kcal <= UNDER_500_KCAL;
}

/**
 * Pure predicate the Recipes surfaces call for a shared category id.
 * `all` (and the Discover-only `trending` / `from-reels`) short-circuit
 * to `true` here — the caller handles those with Discover-only fields.
 */
export function matchesRecipeCategory(
  category: RecipeCategoryId | "trending" | "from-reels",
  recipe: RecipeCategoryRecipe,
): boolean {
  switch (category) {
    case "breakfast":
    case "lunch":
    case "dinner":
    case "dessert":
      return matchesMealType(recipe, category);
    case "quick":
      return isQuick(recipe);
    case "under-500":
      return isUnder500(recipe);
    case "high-protein":
      return isHighProtein(recipe);
    case "soup":
      return titleMatches(recipe.title, SOUP_KEYWORDS);
    case "pasta":
      return titleMatches(recipe.title, PASTA_KEYWORDS);
    case "chicken":
      return titleMatches(recipe.title, CHICKEN_KEYWORDS);
    case "salad":
      return titleMatches(recipe.title, SALAD_KEYWORDS);
    case "all":
    case "trending":
    case "from-reels":
    default:
      // Reset + Discover-only signals are handled by the caller.
      return true;
  }
}
