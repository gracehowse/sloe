/**
 * FatSecret `foods.search` returns each hit with a free-text
 * `food_description` of the shape:
 *
 *   "Per 100g - Calories: 240kcal | Fat: 11.10g | Carbs: 31.20g | Protein: 4.60g"
 *   "Per 1 serving (28g) - Calories: 130kcal | Fat: 7.00g | Carbs: 14.00g | Protein: 2.00g"
 *   "Per 1 sandwich - Calories: 540kcal | Fat: 28.00g | Carbs: 45.00g | Protein: 25.00g"
 *
 * The search response only carries Calories / Fat / Carbs / Protein
 * (and the basis label) — fibre / sugar / sodium and the wider Premier
 * panel only land via `food.get`. The food-search merge pipeline calls
 * `food.get` on tap, so the search-row payload only needs the four
 * headline macros + a hint at the basis.
 *
 * Behaviour contract:
 *   - Returns `null` when the description cannot be parsed (no macros,
 *     unknown shape, all-zero envelope) so the merge pipeline can skip
 *     macros rather than render misleading 0s.
 *   - Returns `basis: "100g"` only when the leading "Per X" segment
 *     names 100g; otherwise the macros are per-serving and callers MUST
 *     fetch the full food detail before scaling.
 *   - Returns the parsed serving label (e.g. "1 sandwich") so the
 *     downstream UI can render an honest "per serving" headline if it
 *     decides to display the search row without a detail fetch.
 *
 * No nutrition values are ever invented — if FatSecret omits a macro
 * the parser returns `null`.
 */

export type FatSecretParsedDescription = {
  /** "100g" when the description is per 100 g; otherwise the natural-portion label. */
  basis: "100g" | "serving";
  /** The "Per X" label as written by FatSecret (e.g. "100g", "1 sandwich (240g)"). */
  servingLabel: string;
  /** Gram weight of the serving when FatSecret embedded it (e.g. "(28g)"); null when only a count is given. */
  servingGrams: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const NUMBER = /(-?\d+(?:\.\d+)?)/;

function num(s: string | undefined): number | null {
  if (s == null) return null;
  const m = s.match(NUMBER);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a FatSecret `food_description` string. Returns null when the
 * envelope is missing macros entirely or when calories+protein+carbs+fat
 * are all zero (placeholder rows surface in FatSecret occasionally).
 */
export function parseFatSecretFoodDescription(
  description: string | null | undefined,
): FatSecretParsedDescription | null {
  if (!description || typeof description !== "string") return null;
  const text = description.trim();
  if (!text) return null;

  // "Per <label> - Calories: <kcal> | Fat: <g> | Carbs: <g> | Protein: <g>"
  // Splitting on " - " is safe because the leading segment never
  // contains " - " in observed responses.
  const sepIdx = text.indexOf(" - ");
  if (sepIdx < 0) return null;
  const head = text.slice(0, sepIdx).trim();
  const tail = text.slice(sepIdx + 3).trim();
  if (!head.toLowerCase().startsWith("per ")) return null;
  const servingLabel = head.slice(4).trim();
  if (!servingLabel) return null;

  // Detect per-100g vs per-serving. FatSecret's per-100g rows always
  // start with the literal "100g" label. Anything else is per-serving.
  const lower = servingLabel.toLowerCase();
  const basis: "100g" | "serving" = lower === "100g" || lower === "100 g" ? "100g" : "serving";

  // Extract macros from the pipe-delimited tail.
  const segs = tail.split("|").map((s) => s.trim());
  let calories: number | null = null;
  let protein: number | null = null;
  let carbs: number | null = null;
  let fat: number | null = null;
  for (const seg of segs) {
    const colon = seg.indexOf(":");
    if (colon < 0) continue;
    const key = seg.slice(0, colon).trim().toLowerCase();
    const val = seg.slice(colon + 1).trim();
    if (key === "calories") calories = num(val);
    else if (key === "protein") protein = num(val);
    else if (key === "carbs" || key === "carbohydrate" || key === "carbohydrates") carbs = num(val);
    else if (key === "fat") fat = num(val);
  }
  if (calories == null || protein == null || carbs == null || fat == null) return null;

  // Skip placeholder rows — FatSecret occasionally exposes brand-stub
  // entries with all-zero macros. Letting these into the search merge
  // would surface "X · 0 kcal" alongside real data. Same guard
  // verifyIngredients uses for the on-tap detail path.
  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) return null;

  // Pull a gram weight out of "(28g)" / "(240g)" when present.
  const gramsMatch = servingLabel.match(/\(\s*(\d+(?:\.\d+)?)\s*g\s*\)/i);
  const servingGrams = gramsMatch ? Number.parseFloat(gramsMatch[1]!) : null;

  return {
    basis,
    servingLabel,
    servingGrams: Number.isFinite(servingGrams as number) ? (servingGrams as number) : null,
    calories: Math.max(0, Math.round(calories)),
    protein: Math.max(0, Math.round(protein * 10) / 10),
    carbs: Math.max(0, Math.round(carbs * 10) / 10),
    fat: Math.max(0, Math.round(fat * 10) / 10),
  };
}
