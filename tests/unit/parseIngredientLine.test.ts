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
});

