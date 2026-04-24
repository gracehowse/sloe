import { parseIngredientLine } from "./parseIngredientLine";

/** Parse free-text recipe lines (e.g. "200g chicken breast") into structured input for verify APIs. */
export function parseRawIngredients(lines: string[]): { name: string; amount: string; unit: string }[] {
  return lines.map((line) => {
    const p = parseIngredientLine(line);
    return { name: p.name || line, amount: p.amount || "1", unit: p.unit || "" };
  });
}
