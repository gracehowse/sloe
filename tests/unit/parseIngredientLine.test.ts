import { describe, expect, it } from "vitest";
import { parseIngredientLine } from "@/lib/recipe-ingredients/parseIngredientLine";

describe("parseIngredientLine", () => {
  it("parses amount/unit/name for simple grams", () => {
    expect(parseIngredientLine("500 g beef mince")).toMatchObject({
      amount: "500",
      unit: "g",
      name: "beef mince",
    });
  });

  it("parses tight weight suffixes", () => {
    expect(parseIngredientLine("beef mince 500g")).toMatchObject({
      amount: "500",
      unit: "g",
      name: "beef mince",
    });
  });

  it("parses multipack formats (2 x 400g)", () => {
    expect(parseIngredientLine("2 x 400g tins chopped tomatoes")).toMatchObject({
      amount: "800",
      unit: "g",
      name: "chopped tomatoes",
    });
  });

  it("parses garlic cloves with trailing prep (unit not at line start)", () => {
    expect(parseIngredientLine("2 garlic cloves finely chopped")).toMatchObject({
      amount: "2",
      unit: "clove",
      name: "garlic finely chopped",
    });
  });

  it("parses celery sticks with trailing prep", () => {
    expect(parseIngredientLine("2 celery sticks finely chopped")).toMatchObject({
      amount: "2",
      unit: "stalk",
      name: "celery finely chopped",
    });
  });

  it("parses unit-first cloves line", () => {
    expect(parseIngredientLine("3 cloves garlic")).toMatchObject({
      amount: "3",
      unit: "clove",
      name: "garlic",
    });
  });

  it("assigns 'medium' unit to whole produce items", () => {
    expect(parseIngredientLine("1 red pepper, diced")).toMatchObject({
      amount: "1",
      unit: "medium",
    });
    expect(parseIngredientLine("2 courgettes (zucchini), grated")).toMatchObject({
      amount: "2",
      unit: "medium",
    });
    expect(parseIngredientLine("1 red onion, sliced")).toMatchObject({
      amount: "1",
      unit: "medium",
    });
  });

  it("does not assign 'medium' to non-produce items", () => {
    expect(parseIngredientLine("1 tbsp olive oil")).toMatchObject({
      unit: "tbsp",
    });
    expect(parseIngredientLine("500g chicken breast")).toMatchObject({
      unit: "g",
    });
  });

  // ── Edge cases identified in audit ─────────────────────────

  it("handles empty string", () => {
    expect(parseIngredientLine("")).toMatchObject({ amount: "", unit: "", name: "" });
  });

  it("handles unicode fractions", () => {
    expect(parseIngredientLine("½ cup flour")).toMatchObject({ amount: "0.5", unit: "cup", name: "flour" });
    expect(parseIngredientLine("¼ tsp salt")).toMatchObject({ amount: "0.25", unit: "tsp", name: "salt" });
  });

  it("handles mixed numbers (1 1/2 cups)", () => {
    expect(parseIngredientLine("1 1/2 cups flour")).toMatchObject({ amount: "1.5", unit: "cup", name: "flour" });
  });

  it("handles simple fractions (1/2 cup)", () => {
    expect(parseIngredientLine("1/2 cup butter")).toMatchObject({ amount: "0.5", unit: "cup", name: "butter" });
  });

  it("strips 'a' / 'an' prefix (no numeric amount = no unit match)", () => {
    // "a pinch of salt" → strips "a" → "pinch of salt" → no numeric amount at start
    // so it returns as plain name. Use "1 pinch salt" for unit-matched parsing.
    const result = parseIngredientLine("a pinch of salt");
    expect(result.name).toBe("pinch of salt");
    // With explicit amount, unit is matched correctly
    const withAmt = parseIngredientLine("1 pinch salt");
    expect(withAmt.unit).toBe("pinch");
    expect(withAmt.name).toBe("salt");
  });

  it("handles ranges (2-3 sprigs)", () => {
    expect(parseIngredientLine("2-3 sprigs thyme")).toMatchObject({ amount: "2-3", unit: "sprig", name: "thyme" });
  });

  it("handles chicken breasts (embedded unit)", () => {
    expect(parseIngredientLine("2 chicken breasts")).toMatchObject({ amount: "2", unit: "breast", name: "chicken" });
  });

  it("handles chicken breasts with comma prep", () => {
    expect(parseIngredientLine("2 chicken breasts, sliced")).toMatchObject({ amount: "2", unit: "breast" });
  });

  it("handles modifier words before units (heaped tbsp)", () => {
    expect(parseIngredientLine("1 heaped tbsp flour")).toMatchObject({ amount: "1", unit: "tbsp", name: "flour" });
  });

  it("handles compact metric without space (500gbeef)", () => {
    expect(parseIngredientLine("500gbeef")).toMatchObject({ amount: "500", unit: "g", name: "beef" });
  });

  it("handles lb unit", () => {
    expect(parseIngredientLine("1 lb ground beef")).toMatchObject({ amount: "1", unit: "lb", name: "ground beef" });
  });

  it("handles fl oz unit", () => {
    expect(parseIngredientLine("4 fl oz cream")).toMatchObject({ amount: "4", unit: "fl oz", name: "cream" });
  });

  it("strips parenthetical weight from ingredient name", () => {
    const result = parseIngredientLine("1 can (14 oz) tomatoes");
    expect(result.name).not.toContain("14 oz");
    expect(result.name).toContain("tomatoes");
  });

  it("strips parenthetical grams from ingredient name", () => {
    const result = parseIngredientLine("2 tins (400g) chickpeas");
    expect(result.name).not.toContain("400g");
    expect(result.name).toContain("chickpeas");
  });
});

