/**
 * F-158 / ENG-564 — cooked chicken count-to-weight + USDA query aliases.
 */
import { describe, expect, it } from "vitest";
import { applyNameAliases } from "@/lib/nutrition/verifyIngredients";
import { measureToGrams } from "@/lib/nutrition/measureToGrams";

describe("ENG-564 cooked chicken import", () => {
  it("maps cooked chicken ingredient text to cooked USDA search alias", () => {
    expect(applyNameAliases("cooked chicken shredded")).toMatch(/cooked/i);
    expect(applyNameAliases("cooked chicken shredded")).not.toMatch(/\braw\b/i);
  });

  it("2 cooked chicken breasts resolve to ~500 kcal at typical cooked macros", () => {
    const grams = measureToGrams({ name: "cooked chicken shredded", amount: 2, unit: "breast" });
    expect(grams).toBe(300);
    const kcal = Math.round((165 * grams) / 100);
    expect(kcal).toBeGreaterThanOrEqual(450);
    expect(kcal).toBeLessThanOrEqual(550);
  });
});
