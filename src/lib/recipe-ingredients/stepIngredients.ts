/**
 * stepIngredients — match a recipe step's instruction text against the
 * recipe's structured ingredients, so cook mode can render a calm
 * "For this step" chip row beneath each instruction (ENG-944).
 *
 * Why this exists:
 *   The #1 cook-mode complaint is scrolling back up to re-check "how much
 *   butter again?" on step 4. We surface the relevant ingredients inline
 *   under each step. The recipe model stores instructions as free-text
 *   strings, NOT as structured (step → ingredient) links, so we infer the
 *   link with a pure, token-level matcher against the existing structured
 *   ingredient list. NO schema change.
 *
 * Design rules (project non-negotiable: never fabricate an ingredient
 * match — when uncertain, OMIT):
 *   - Case-insensitive.
 *   - Word-boundary / token matching, never substring. "butter" must not
 *     match inside "buttermilk" or "butterfly the chicken".
 *   - Simple plural folding: a trailing "s"/"es"/"ies" is normalised so
 *     "tomatoes" in the step matches the "tomato" ingredient (and vice
 *     versa). We deliberately keep this conservative — it's suffix
 *     stripping, not a stemmer.
 *   - Multi-word ingredient names ("olive oil", "chicken breast") require
 *     EVERY significant word of the name to appear as a token in the step.
 *     We do not require contiguity (recipes say "the oil" then later
 *     "the olive") — but every content word must be present, so a step
 *     mentioning only "oil" will not match "olive oil" unless "olive" is
 *     also present. This errs toward omission over a wrong chip.
 *   - Stopwords + descriptor words ("of", "the", "fresh", "chopped",
 *     "to", "taste") are dropped from the ingredient name before matching
 *     so "freshly chopped garlic" still matches a step that says "garlic".
 *     A name that reduces to ONLY stopwords (e.g. "to taste") never
 *     matches anything.
 *
 * Pure: no React, no DOM, no RN, no I/O. Safe to import anywhere and to
 * call on every render. Shared by web (`CookMode.tsx`,
 * `src/app/components/RecipeDetail.tsx`) and mobile
 * (`apps/mobile/app/cook.tsx`, `apps/mobile/app/recipe/[id].tsx`).
 */

import { formatIngredientAmountUnit } from "./formatIngredientAmount";
import { scaleAmountText } from "../nutrition/recipeScale";

/** The minimal ingredient shape the matcher needs. Both the web
 *  `IngredientRow` and the mobile recipe-detail `Ingredient` type are
 *  assignable to this (amount may be a number, string, or null). */
export interface StepMatchableIngredient {
  name: string;
  amount?: string | number | null;
  unit?: string | null;
}

/** A matched ingredient for a step, in the original ingredient order. The
 *  index is the position in the recipe's ingredient list so callers can
 *  de-dupe or key chips stably. */
export interface StepIngredientMatch {
  /** Index into the ingredient array passed to {@link ingredientsForStep}. */
  index: number;
  /** The ingredient as supplied (untrimmed, original casing). */
  ingredient: StepMatchableIngredient;
}

/**
 * Words we strip from an ingredient name before tokenising for the match.
 * Two buckets, merged into one set:
 *   - grammatical glue ("of", "the", "and", "or", "to", "a", "an", "with")
 *   - prep / descriptor adjectives that appear on the INGREDIENT line but
 *     not necessarily in the STEP ("fresh", "chopped", "diced", …). We
 *     drop them so the name reduces to its content nouns; the step rarely
 *     repeats the full descriptor.
 * Kept deliberately tight — anything not here is treated as a content
 * word that MUST be present in the step for a multi-word match. Stored in
 * singular form because we singularise BEFORE filtering (so "slices" folds
 * to "slice" then matches the stopword "slice").
 */
const NAME_STOPWORDS = new Set<string>([
  // grammatical glue
  "of", "the", "a", "an", "and", "or", "to", "with", "for", "in", "into",
  "plus", "extra", "your", "any",
  // measure-y words that sometimes leak into a name column
  "taste", "season", "seasoning", "needed", "required", "optional",
  // common prep / state descriptors (present on the ingredient line, not
  // the step). Conservative list — only unambiguous prep words.
  "fresh", "freshly", "dried", "ground", "whole", "large", "medium",
  "small", "ripe", "raw", "cooked", "chopped", "diced", "minced", "sliced",
  "slice", "grated", "shredded", "crushed", "peeled", "trimmed", "boneless",
  "skinless", "finely", "roughly", "coarsely", "thinly", "thickly",
  "softened", "melted", "beaten", "divided", "packed", "drained", "rinsed",
  "roasted", "toasted", "good", "quality", "free", "range", "organic",
]);

/**
 * Fold a single token toward a singular base for comparison.
 *   "tomatoes" → "tomato", "leaves" → "leaf",
 *   "berries"  → "berry", "onions" → "onion", "cloves" → "clove".
 *
 * This is intentionally a small suffix rule set, not a real stemmer. We
 * apply the SAME folding to both the step tokens and the ingredient
 * tokens, so as long as the rule is consistent the two sides meet in the
 * middle even when the fold isn't a "correct" English singular. Tokens of
 * length ≤ 3 are returned unchanged (folding "is"/"as"/"gas" would create
 * collisions and there are no 3-letter plural ingredients worth the risk).
 */
function singularize(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith("ies")) {
    // "berries" → "berry"
    return token.slice(0, -3) + "y";
  }
  if (
    token.endsWith("ses") || token.endsWith("xes") || token.endsWith("zes") ||
    token.endsWith("ches") || token.endsWith("shes")
  ) {
    // "dishes" → "dish", "boxes" → "box"
    return token.slice(0, -2);
  }
  if (token.endsWith("oes")) {
    // "tomatoes" → "tomato", "potatoes" → "potato"
    return token.slice(0, -2);
  }
  if (token.endsWith("ves")) {
    // "leaves" → "leaf", "halves" → "half"
    return token.slice(0, -3) + "f";
  }
  if (token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("us")) {
    // "onions" → "onion". Guard "ss" (glass) and "us" (citrus, hummus).
    return token.slice(0, -1);
  }
  return token;
}

/** Lowercase, split on any non-letter run, drop empties, singularise. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z]+/i)
    .filter((t) => t.length > 0)
    .map(singularize);
}

/**
 * Reduce an ingredient name to its set of matchable content tokens:
 * lowercase, split, singularise, drop stopwords/descriptors. A name that
 * reduces to nothing (e.g. "to taste" → []) means "never matches".
 */
function ingredientContentTokens(name: string): string[] {
  const tokens = tokenize(name);
  return tokens.filter((t) => !NAME_STOPWORDS.has(t));
}

/**
 * Return the recipe ingredients referenced in a single step's instruction
 * text, in original ingredient order, de-duplicated by ingredient index.
 *
 * Matching contract (see file header):
 *   - Build the set of singularised word tokens present in the step.
 *   - For each ingredient, reduce its name to content tokens and require
 *     that EVERY content token is present in the step's token set.
 *   - An ingredient with no content tokens (e.g. "to taste") never
 *     matches.
 *   - A step with no recognisable tokens, or empty/whitespace, yields [].
 *
 * Token-set membership (not substring search) is what gives word-boundary
 * safety: "butter" is a token only if "butter" stands alone in the step,
 * so "buttermilk" / "butterfly" never trigger it.
 */
export function ingredientsForStep(
  stepText: string,
  ingredients: readonly StepMatchableIngredient[],
): StepIngredientMatch[] {
  if (typeof stepText !== "string" || !stepText.trim()) return [];
  if (!Array.isArray(ingredients) || ingredients.length === 0) return [];

  const stepTokens = new Set(tokenize(stepText));
  if (stepTokens.size === 0) return [];

  const matches: StepIngredientMatch[] = [];
  for (let index = 0; index < ingredients.length; index++) {
    const ingredient = ingredients[index]!;
    const name = typeof ingredient?.name === "string" ? ingredient.name : "";
    const content = ingredientContentTokens(name);
    if (content.length === 0) continue;
    const allPresent = content.every((t) => stepTokens.has(t));
    if (allPresent) {
      matches.push({ index, ingredient });
    }
  }
  return matches;
}

/**
 * Build the "amount + name" label for a single step chip, scale-aware.
 *
 * The amount/unit are first composed via {@link formatIngredientAmountUnit}
 * (the same de-dupe used by the recipe-detail ingredient rows), then the
 * composed quantity is rewritten through `scaleAmountText` so the chip
 * respects the active serving scale exactly like the step text does — a
 * "2 tbsp butter" line at 0.5x reads "1 tbsp butter".
 *
 * `scaleFactor` of 1 (or invalid) leaves the amount verbatim (the helper
 * short-circuits). When there is no amount/unit at all the chip is just the
 * ingredient name.
 *
 * Examples (factor 1):
 *   { amount: 2, unit: "tbsp", name: "butter" } → "2 tbsp butter"
 *   { amount: "1", unit: "", name: "egg" }      → "1 egg"
 *   { amount: null, unit: null, name: "salt" }  → "salt"
 * At factor 2:
 *   { amount: 2, unit: "tbsp", name: "butter" } → "4 tbsp butter"
 */
export function stepIngredientChipLabel(
  ingredient: StepMatchableIngredient,
  scaleFactor = 1,
): string {
  const name = (ingredient?.name ?? "").trim();
  const amountUnit = formatIngredientAmountUnit(
    ingredient?.amount ?? null,
    ingredient?.unit ?? null,
  );
  if (!amountUnit) return name;
  const scaled =
    Number.isFinite(scaleFactor) && scaleFactor > 0 && scaleFactor !== 1
      ? scaleAmountText(amountUnit, scaleFactor)
      : amountUnit;
  if (!name) return scaled;
  return `${scaled} ${name}`;
}

/** A ready-to-render chip: a stable key (the ingredient's index) and the
 *  scale-aware "amount + name" label. */
export interface StepIngredientChip {
  key: number;
  label: string;
}

/**
 * The full "For this step" chip computation shared by every cook surface
 * (web `CookMode.tsx`, mobile `cook.tsx` + the inline `recipe/[id].tsx`
 * overlay). Combines the feature-flag gate, the matcher, and the
 * scale-aware label so the three call sites can't drift.
 *
 * `enabled` is the resolved `cook_step_ingredients_v1` flag value, passed
 * in by the caller (each platform reads its own `isFeatureEnabled`). When
 * the flag is OFF the result is ALWAYS `[]`, so the UI renders nothing —
 * byte-identical to pre-ENG-944 behaviour.
 */
export function cookStepIngredientChips(
  enabled: boolean,
  stepText: string,
  ingredients: readonly StepMatchableIngredient[],
  scaleFactor = 1,
): StepIngredientChip[] {
  if (!enabled) return [];
  return ingredientsForStep(stepText, ingredients).map((m) => ({
    key: m.index,
    label: stepIngredientChipLabel(m.ingredient, scaleFactor),
  }));
}
