import { ingredientToLine, type StructuredIngredient } from "../recipe-import/structuredRecipeSchema";

export type StepIngredient = Pick<StructuredIngredient, "quantity" | "unit" | "name" | "prep"> &
  Partial<Pick<StructuredIngredient, "confidence" | "flagged" | "raw">>;

export type StepCentricRecipeStep = {
  text: string;
  ingredients?: StepIngredient[] | null;
};

function normaliseName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/g, "");
}

function isProcessedOrDerivedIngredient(ingredient: StepIngredient): boolean {
  const haystack = [ingredient.name, ingredient.prep, ingredient.raw].filter(Boolean).join(" ").toLowerCase();
  return (
    /\bmixed with\b/.test(haystack) ||
    /\b(combined|stirred|whisked|dissolved)\s+(with|in|into)\b/.test(haystack) ||
    (/\bto serve\b/.test(haystack) && /\boptional\b/.test(haystack))
  );
}

function toStructuredIngredient(ingredient: StepIngredient): StructuredIngredient | null {
  const name = ingredient.name.trim();
  if (!name || isProcessedOrDerivedIngredient(ingredient)) return null;
  const confidence = ingredient.confidence ?? 1;
  const structured: StructuredIngredient = {
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    name,
    prep: ingredient.prep,
    confidence,
    flagged: ingredient.flagged ?? confidence < 0.6,
    raw: ingredient.raw ?? "",
  };
  structured.raw = structured.raw || ingredientToLine(structured);
  return structured;
}

/**
 * Derive the legacy flat ingredient list from step-nested ingredients.
 *
 * Order is first-use across the method; duplicate names are collapsed by a
 * normalized ingredient name so shopping/nutrition callers keep one canonical
 * row while cook mode can still render per-step amount chips from the source
 * steps. Prep-state/serving-note rows are dropped using the ENG-1136 rules.
 */
export function flattenStepIngredients(steps: StepCentricRecipeStep[]): StructuredIngredient[] {
  const seen = new Set<string>();
  const flattened: StructuredIngredient[] = [];

  for (const step of steps) {
    for (const ingredient of step.ingredients ?? []) {
      const structured = toStructuredIngredient(ingredient);
      if (!structured) continue;
      const key = normaliseName(structured.name);
      if (seen.has(key)) continue;
      seen.add(key);
      flattened.push(structured);
    }
  }

  return flattened;
}

export function flattenStepIngredientLines(steps: StepCentricRecipeStep[]): string[] {
  return flattenStepIngredients(steps).map(ingredientToLine).filter(Boolean);
}
