/**
 * ENG-945 — canonical navigation to the rich `/cook` screen.
 * Replaces the thin inline overlay that used to live in `recipe/[id].tsx`.
 */

export type CookModeIngredientParam = {
  name: string;
  amount?: number | string | null;
  unit?: string | null;
};

export type BuildCookModeHrefInput = {
  recipeId: string;
  title: string;
  steps: string[];
  servings?: number | null;
  /** Initial scale / portion multiplier (Paprika parity). Omitted when 1×. */
  portion?: number;
  sourceVideoUrl?: string | null;
  sourceUrl?: string | null;
  ingredients?: CookModeIngredientParam[];
};

export function buildCookModeHref(input: BuildCookModeHrefInput): string {
  const params = new URLSearchParams();
  params.set("recipeId", input.recipeId);
  params.set("title", input.title);
  params.set("steps", JSON.stringify(input.steps));

  if (input.servings != null && Number.isFinite(input.servings) && input.servings > 0) {
    params.set("servings", String(Math.round(input.servings)));
  }
  if (
    input.portion != null &&
    Number.isFinite(input.portion) &&
    input.portion > 0 &&
    input.portion !== 1
  ) {
    params.set("portion", String(input.portion));
  }
  const sourceVideo = input.sourceVideoUrl?.trim();
  if (sourceVideo) params.set("sourceVideoUrl", sourceVideo);
  const source = input.sourceUrl?.trim();
  if (source) params.set("sourceUrl", source);
  if (input.ingredients && input.ingredients.length > 0) {
    const slim = input.ingredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount ?? null,
      unit: ing.unit ?? null,
    }));
    params.set("ingredients", JSON.stringify(slim));
  }
  return `/cook?${params.toString()}`;
}
