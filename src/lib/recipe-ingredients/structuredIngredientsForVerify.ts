import { parseIngredientLine } from "./parseIngredientLine";

/** When amount is empty but the name still contains "500g …", parse so nutrition + save match. */
export function resolveStructuredIngredient(i: {
  name: string;
  amount: string;
  unit: string;
}): { name: string; amount: string; unit: string } {
  const name = i.name.trim();
  let amount = i.amount.trim();
  let unit = i.unit.trim();
  let foodName = name;
  if (!amount && foodName) {
    const p = parseIngredientLine(foodName);
    if (p.amount && p.name.trim()) {
      amount = p.amount;
      unit = p.unit || unit;
      foodName = p.name.trim();
    }
  }
  return { name: foodName, amount: amount || "1", unit };
}

/**
 * Build `/api/nutrition/verify-recipe` payloads from persisted
 * `{ name, amount, unit }` rows. Pre-fix callers passed `name` only
 * through `parseRawIngredients`, which defaulted every line to
 * `amount: "1"` and dropped tbsp/cup/g — breaking USDA/OFF matches.
 */
export function structuredIngredientsForVerify(
  rows: { name: string; amount?: string | number | null; unit?: string | null }[],
): { name: string; amount: string; unit: string }[] {
  return rows.map((row) =>
    resolveStructuredIngredient({
      name: String(row.name ?? "").trim(),
      amount: row.amount != null && String(row.amount).trim() ? String(row.amount).trim() : "",
      unit: row.unit != null && String(row.unit).trim() ? String(row.unit).trim() : "",
    }),
  );
}
