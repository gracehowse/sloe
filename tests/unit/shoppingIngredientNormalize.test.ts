import { describe, expect, it } from "vitest";
import {
  normalizeShoppingIngredientRow,
  sanitizeShoppingIngredientName,
} from "@/lib/planning/normalizeShoppingIngredientRow";

describe("sanitizeShoppingIngredientName", () => {
  it("removes USDA undetermined medium boilerplate", () => {
    const raw =
      '8 1 undetermined medium (4-1/8" long) Onions, spring or scallions (includes tops and bulb), raw';
    expect(sanitizeShoppingIngredientName(raw)).toBe("Spring onions");
  });

  it("removes stray percent signs", () => {
    expect(sanitizeShoppingIngredientName("500 g % beef mince (or mince of choice)")).toBe(
      "500 g beef mince (or mince of choice)",
    );
  });

  it("collapses duplicated count prefix", () => {
    expect(sanitizeShoppingIngredientName("1 1 breast Chicken breast")).toBe("1 breast Chicken breast");
  });
});

describe("normalizeShoppingIngredientRow", () => {
  it("splits embedded grams from name into amount and unit", () => {
    expect(
      normalizeShoppingIngredientRow({
        name: "600 g spinach, chopped",
        amount: "",
        unit: "",
      }),
    ).toEqual({ name: "spinach, chopped", amount: "600", unit: "g" });
  });

  it("dedupes amount already present in name", () => {
    expect(
      normalizeShoppingIngredientRow({
        name: "60 g protein powder",
        amount: "60",
        unit: "g",
      }),
    ).toEqual({ name: "protein powder", amount: "60", unit: "g" });
  });

  it("normalizes jar rows for merge", () => {
    expect(
      normalizeShoppingIngredientRow({
        name: "jar chickpeas, drained",
        amount: "1",
        unit: "jar",
      }),
    ).toEqual({ name: "chickpeas, drained", amount: "1", unit: "jar" });
  });

  it("prefers embedded ml over bare count amount", () => {
    expect(
      normalizeShoppingIngredientRow({
        name: "240 ml Almond milk",
        amount: "1",
        unit: "",
      }),
    ).toEqual({ name: "Almond milk", amount: "240", unit: "ml" });
  });
});
