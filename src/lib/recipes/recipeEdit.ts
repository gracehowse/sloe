/**
 * recipeEdit — shared, platform-agnostic logic for the recipe-edit
 * surfaces (ENG-759: full recipe editing on web + mobile).
 *
 * Both the mobile `RecipeEditSheet` and the web `RecipeEditDialog`
 * import these helpers so the metadata validation, the meal-type
 * toggle, the per-serving aggregate recompute, and the manual-add
 * ingredient shape stay in lock-step across platforms. Keeping the
 * logic here (not duplicated in two component files) is the only way
 * to guarantee web == mobile and to keep it unit-testable without
 * rendering React Native.
 *
 * Nutrition-correctness rules honoured here:
 *  - A manually added ingredient invents NO nutrition. It is created
 *    with zeroed macros, `added_by_user: true`, `is_verified: false`,
 *    and source "Manual" so the row reads honestly as unverified. The
 *    user can run the existing per-ingredient verify flow afterwards.
 *  - The aggregate recompute is the SAME maths the yield-edit path
 *    already uses (sum of ingredient macros ÷ servings). It never
 *    fabricates totals — if every ingredient is zero (e.g. all rows
 *    just added manually and not yet verified), the aggregate is zero.
 */

/** Canonical meal-type chip values (matches `recipes.meal_type` string[]). */
export const RECIPE_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type RecipeMealType = (typeof RECIPE_MEAL_TYPES)[number];

export const RECIPE_TITLE_MAX_LENGTH = 120;
export const RECIPE_SERVINGS_MIN = 1;
export const RECIPE_SERVINGS_MAX = 48;

/** Editable metadata fields surfaced in the edit sheet/dialog.
 *  Time fields accept raw strings (mobile/web text inputs) or numbers —
 *  `parseNullableMinutes` normalises both to a positive int or null. */
export type RecipeMetadataDraft = {
  title: string;
  description: string;
  servings: number;
  mealType: string[];
  prepTimeMin: string | number | null;
  cookTimeMin: string | number | null;
  instructions: string;
};

/** The exact column shape written to `recipes` on a metadata save. */
export type RecipeMetadataUpdate = {
  title: string;
  description: string | null;
  servings: number;
  meal_type: string[] | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  instructions: string | null;
};

/** Whether the owner gate should expose the edit UI. */
export function canEditRecipe(
  authorId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  return Boolean(userId && authorId && authorId === userId);
}

/** Clamp servings into the allowed range (defends against bad input). */
export function clampRecipeServings(raw: number): number {
  if (!Number.isFinite(raw)) return RECIPE_SERVINGS_MIN;
  const n = Math.round(raw);
  if (n < RECIPE_SERVINGS_MIN) return RECIPE_SERVINGS_MIN;
  if (n > RECIPE_SERVINGS_MAX) return RECIPE_SERVINGS_MAX;
  return n;
}

/** Parse a free-text number field to a positive int, or null when blank/invalid. */
export function parseNullableMinutes(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/** Toggle a meal-type chip on/off, preserving canonical order. */
export function toggleMealType(current: string[], value: RecipeMealType): string[] {
  const has = current.includes(value);
  const next = has ? current.filter((m) => m !== value) : [...current, value];
  // Re-order to canonical sequence so the persisted array is stable.
  return RECIPE_MEAL_TYPES.filter((m) => next.includes(m));
}

/** A title must be non-empty after trimming. */
export function isMetadataDraftValid(draft: Pick<RecipeMetadataDraft, "title">): boolean {
  return draft.title.trim().length > 0;
}

/**
 * Build the `recipes` update payload from a metadata draft. Empty
 * strings collapse to null (so we don't persist "" over a real value),
 * title is trimmed + length-capped, servings clamped, meal_type empties
 * to null.
 */
export function buildRecipeMetadataUpdate(draft: RecipeMetadataDraft): RecipeMetadataUpdate {
  const title = draft.title.trim().slice(0, RECIPE_TITLE_MAX_LENGTH);
  const description = draft.description.trim();
  const instructions = draft.instructions.trim();
  const mealType = RECIPE_MEAL_TYPES.filter((m) => draft.mealType.includes(m));
  return {
    title,
    description: description.length > 0 ? description : null,
    servings: clampRecipeServings(draft.servings),
    meal_type: mealType.length > 0 ? mealType : null,
    prep_time_min: parseNullableMinutes(draft.prepTimeMin),
    cook_time_min: parseNullableMinutes(draft.cookTimeMin),
    instructions: instructions.length > 0 ? instructions : null,
  };
}

/** Minimal macro-bearing ingredient shape the recompute reads. */
export type AggregatableIngredient = {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
};

/** Per-serving aggregate written to the `recipes` row. */
export type RecipeAggregate = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
};

/**
 * Recompute per-serving recipe macros from the ingredient list. This is
 * the SAME maths the yield-edit path uses (sum ÷ servings) — extracted
 * so the ingredient-CRUD path and the yield path can never drift.
 *
 * Calories/protein/carbs/fat/sodium round to whole numbers; fibre and
 * sugar keep one decimal (matching the existing yield-edit + wizard
 * write shapes). Servings is clamped to ≥1 to avoid divide-by-zero.
 */
export function recomputeRecipeAggregate(
  ingredients: AggregatableIngredient[],
  servings: number,
): RecipeAggregate {
  const s = Math.max(RECIPE_SERVINGS_MIN, Math.round(servings) || RECIPE_SERVINGS_MIN);
  const sum = ingredients.reduce(
    (acc, i) => ({
      calories: acc.calories + (i.calories ?? 0),
      protein: acc.protein + (i.protein ?? 0),
      carbs: acc.carbs + (i.carbs ?? 0),
      fat: acc.fat + (i.fat ?? 0),
      fiber_g: acc.fiber_g + (i.fiber_g ?? 0),
      sugar_g: acc.sugar_g + (i.sugar_g ?? 0),
      sodium_mg: acc.sodium_mg + (i.sodium_mg ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 },
  );
  return {
    calories: Math.max(0, Math.round(sum.calories / s)),
    protein: Math.max(0, Math.round(sum.protein / s)),
    carbs: Math.max(0, Math.round(sum.carbs / s)),
    fat: Math.max(0, Math.round(sum.fat / s)),
    fiber_g: Math.max(0, Math.round((sum.fiber_g / s) * 10) / 10),
    sugar_g: Math.max(0, Math.round((sum.sugar_g / s) * 10) / 10),
    sodium_mg: Math.max(0, Math.round(sum.sodium_mg / s)),
  };
}

/** The `recipe_ingredients` insert payload for a manual add (no nutrition fetch). */
export type ManualIngredientInsert = {
  recipe_id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  added_by_user: true;
  is_verified: false;
  source: "Manual";
};

/**
 * Build the insert row for a manually added ingredient. Invents NO
 * nutrition: macros are zeroed, the row is flagged `added_by_user` +
 * unverified so the UI reads honestly. The user can verify it later
 * via the existing per-ingredient verify flow.
 */
export function buildManualIngredientInsert(input: {
  recipeId: string;
  name: string;
  amount: string | number | null;
  unit: string | null;
}): ManualIngredientInsert {
  const amountNum =
    input.amount == null || input.amount === ""
      ? null
      : typeof input.amount === "number"
        ? input.amount
        : (() => {
            const n = parseFloat(String(input.amount));
            return Number.isFinite(n) ? n : null;
          })();
  const unit = input.unit?.trim() ? input.unit.trim() : null;
  return {
    recipe_id: input.recipeId,
    name: input.name.trim(),
    amount: amountNum,
    unit,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber_g: 0,
    sugar_g: 0,
    sodium_mg: 0,
    added_by_user: true,
    is_verified: false,
    source: "Manual",
  };
}
