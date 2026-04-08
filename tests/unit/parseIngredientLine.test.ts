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
});

