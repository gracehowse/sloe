// Extensionless relative imports — mobile-safe (Metro + the mobile tsconfig).
//
// ENG-1634 — "Smart suggestions" for the shopping list / plan: recommend
// recipes that reuse ingredients already being bought, ranked primarily by
// ingredient overlap and secondarily annotated by remaining-macro fit.
//
// Distinct from `smartSuggestions.ts` (ENG-1193): that module suggests
// recipes sharing ingredients with what's already ON THE PLAN (a "round out
// your week" nudge, scored on overlap alone, surfaced only on the Plan tab).
// This module answers a different question — "of the recipes I could cook,
// which ones avoid buying anything new AND fit what's left of today's
// macros?" — sourced from the shopping list (which ENG-957 already keeps in
// sync with the plan, so "list" and "plan" ingredients converge here), and
// it adds the macro-fit secondary signal ENG-1193 never had. Both may run
// side by side.
//
// Pure, deterministic, no I/O — hosts fetch candidate recipes + ingredient
// rows and resolve the current ingredient set + remaining macro budget, then
// call `rankIngredientOverlapSuggestions`.
import { normalizeIngredientNameKey } from "./ingredientNameKey";

/** A candidate recipe's ingredient — only the display name matters for overlap. */
export type OverlapCandidateIngredient = { name: string };

/**
 * A recipe under consideration. Macro fields are PER SERVING (the
 * `RecipeCard` convention — see `RecipeDetail.tsx`'s `dbMacros`/`perServing`
 * usage) — never a whole-recipe total. Omit a macro field (rather than
 * passing `0`) when it genuinely isn't known; the ranker never guesses a
 * missing value; a bona fide `0` (e.g. a fat-free food) is treated as data.
 */
export type OverlapCandidateRecipe = {
  id: string;
  title: string;
  ingredients: readonly OverlapCandidateIngredient[];
  caloriesPerServing?: number | null;
  proteinPerServing?: number | null;
  carbsPerServing?: number | null;
  fatPerServing?: number | null;
};

/** The subset of `RemainingMacros` (`src/lib/nutrition/remainingMacros.ts`)
 *  this module needs — accepts the canonical shape directly so hosts never
 *  have to reshape `computeRemaining(...)`'s output before calling in. */
export type RemainingMacroBudget = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type ShoppingSmartSuggestionMacroFit = {
  /** 0..1 — 1 = the recipe uses almost exactly what's left without overshooting. */
  score: number;
  /** Calm, factual annotation copy for the row (never body-shaming). */
  label: string;
};

export type ShoppingSmartSuggestion = {
  recipeId: string;
  title: string;
  /** Shared ingredient display names (candidate-recipe order, deduped). */
  overlapIngredientNames: string[];
  overlapCount: number;
  totalIngredientCount: number;
  /** overlapCount / totalIngredientCount, 0..1. */
  overlapRatio: number;
  /** `null` when no `remainingBudget` was supplied, or the recipe reports
   *  no usable macro data at all — never a fabricated annotation. */
  macroFit: ShoppingSmartSuggestionMacroFit | null;
};

/** Relative importance of each macro in the fit score. Calories dominates
 *  (it's the number everyone tracks); protein next (the macro Sloe users
 *  care most about hitting); carbs/fat split the remainder evenly. */
const MACRO_FIT_WEIGHTS = {
  calories: 0.4,
  protein: 0.3,
  carbs: 0.15,
  fat: 0.15,
} as const;

type MacroKey = keyof typeof MACRO_FIT_WEIGHTS;

/**
 * Triangular "how well does using `amount` of this macro fill `remaining`?"
 * score, 0..1. Peaks at `amount === remaining` (uses exactly what's left);
 * falls off symmetrically as the recipe uses much less (leaves headroom
 * unused — fine, not penalized hard) or overshoots (tips the day over).
 */
function macroComponentFit(amount: number, remaining: number): number {
  if (remaining <= 0) {
    // No budget left for this macro — using more of it is never a "fit",
    // using none of it is a perfect fit.
    return amount > 0 ? 0 : 1;
  }
  if (amount <= 0) return 0.5; // recipe doesn't touch this macro — neutral.
  const ratio = amount / remaining;
  return ratio <= 1 ? ratio : Math.max(0, 1 - (ratio - 1));
}

/** Per-recipe macro key → per-serving amount lookup (kept out of the loop body). */
const MACRO_FIELD: Record<MacroKey, keyof OverlapCandidateRecipe> = {
  calories: "caloriesPerServing",
  protein: "proteinPerServing",
  carbs: "carbsPerServing",
  fat: "fatPerServing",
};

/**
 * Weighted macro-fit score for one candidate against the remaining budget.
 * Renormalises weights across only the macros the recipe actually reports —
 * a recipe missing carb/fat data (e.g. a partially-verified import) is
 * scored on what IS known rather than penalized for the gap. Returns `null`
 * when the recipe reports NO usable macro data (nothing to score — the
 * nutrition-trust rule against fabricating a signal from nothing).
 */
function macroFitForCandidate(
  recipe: OverlapCandidateRecipe,
  budget: RemainingMacroBudget,
): ShoppingSmartSuggestionMacroFit | null {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const key of Object.keys(MACRO_FIT_WEIGHTS) as MacroKey[]) {
    const amount = recipe[MACRO_FIELD[key]] as number | null | undefined;
    if (amount == null) continue; // missing data — skip, never guess.
    const weight = MACRO_FIT_WEIGHTS[key];
    weightedSum += macroComponentFit(amount, budget[key]) * weight;
    weightTotal += weight;
  }
  if (weightTotal === 0) return null;
  const score = weightedSum / weightTotal;
  return { score, label: macroFitLabel(score) };
}

function macroFitLabel(score: number): string {
  if (score >= 0.7) return "Fits well with what's left today";
  if (score >= 0.4) return "Uses some of today's remaining budget";
  return "Uses more than what's left today";
}

/** Distinct, normalised ingredients for a recipe (first display spelling wins). */
function distinctIngredients(
  ingredients: readonly OverlapCandidateIngredient[],
): Array<{ key: string; display: string }> {
  const seen = new Map<string, string>();
  for (const ing of ingredients) {
    const key = normalizeIngredientNameKey(ing.name);
    if (!key || seen.has(key)) continue;
    seen.set(key, ing.name.trim());
  }
  return [...seen.entries()].map(([key, display]) => ({ key, display }));
}

export function rankIngredientOverlapSuggestions(input: {
  /** Ingredient display names already on the shopping list (which ENG-957
   *  keeps synced with the plan) — or the plan's raw ingredient set. */
  currentIngredientNames: readonly string[];
  /** Candidate recipes to consider — typically the user's saved library. */
  candidates: readonly OverlapCandidateRecipe[];
  /** Today's (or the plan's) remaining macro budget. Omit to rank on overlap
   *  alone with no macro-fit annotation. */
  remainingBudget?: RemainingMacroBudget | null;
  /** Recipe ids to exclude (e.g. already on this week's plan). */
  excludeRecipeIds?: ReadonlySet<string>;
  /** Minimum shared-ingredient count to qualify. A single shared onion isn't
   *  a "reuses your list" suggestion — default 2. */
  minOverlap?: number;
  /** Max suggestions returned. */
  limit?: number;
}): ShoppingSmartSuggestion[] {
  const minOverlap = input.minOverlap ?? 2;
  const limit = input.limit ?? 6;

  const currentKeys = new Set(
    input.currentIngredientNames
      .map((n) => normalizeIngredientNameKey(n))
      .filter((k) => k.length > 0),
  );
  if (currentKeys.size === 0) return [];

  const out: ShoppingSmartSuggestion[] = [];
  for (const candidate of input.candidates) {
    if (input.excludeRecipeIds?.has(candidate.id)) continue;
    const distinct = distinctIngredients(candidate.ingredients);
    if (distinct.length === 0) continue;

    const overlap = distinct.filter((d) => currentKeys.has(d.key));
    if (overlap.length < minOverlap) continue;

    out.push({
      recipeId: candidate.id,
      title: candidate.title,
      overlapIngredientNames: overlap.map((d) => d.display),
      overlapCount: overlap.length,
      totalIngredientCount: distinct.length,
      overlapRatio: overlap.length / distinct.length,
      macroFit: input.remainingBudget
        ? macroFitForCandidate(candidate, input.remainingBudget)
        : null,
    });
  }

  // Overlap is the PRIMARY signal (strict first key); macro fit is the
  // secondary signal used to break overlap ties; ratio and title keep the
  // order fully deterministic below that.
  out.sort((a, b) => {
    if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount;
    const aFit = a.macroFit?.score ?? -1;
    const bFit = b.macroFit?.score ?? -1;
    if (bFit !== aFit) return bFit - aFit;
    if (b.overlapRatio !== a.overlapRatio) return b.overlapRatio - a.overlapRatio;
    return a.title.localeCompare(b.title);
  });

  return out.slice(0, limit);
}

/**
 * "Also uses Garlic Clove, Fish Sauce, Jasmine Rice…" — shared copy so web +
 * mobile can't drift on the truncation rule. Trailing ellipsis (not "+N
 * more") matches the ENG-1634 brief's own example copy verbatim.
 */
export function formatOverlapSummary(names: readonly string[], max = 3): string {
  if (names.length === 0) return "";
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown}…` : shown;
}
