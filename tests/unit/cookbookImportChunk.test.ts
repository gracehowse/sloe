import { describe, it, expect } from "vitest";
import { chunkTextForCookbookParse } from "@/lib/planning/planImport/chunkTextForCookbookParse";
import { mergeCookbookRecipes } from "@/lib/planning/planImport/mergeCookbookRecipes";
import type { PlanImportParsedRecipe } from "@/lib/planning/planImport/types";

describe("chunkTextForCookbookParse", () => {
  it("returns a single chunk for short text", () => {
    const text = "Recipe one\nIngredients: egg";
    expect(chunkTextForCookbookParse(text)).toEqual([text]);
  });

  it("splits on form-feed page breaks when over chunk size", () => {
    const page = "x".repeat(25_000);
    const text = `${page}\f${page}`;
    const chunks = chunkTextForCookbookParse(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toContain("x");
  });
});

describe("mergeCookbookRecipes", () => {
  it("dedupes by recipe key (first wins)", () => {
    const a: PlanImportParsedRecipe = {
      key: "salad",
      title: "Salad A",
      serves: 2,
      ingredients: ["lettuce"],
    };
    const b: PlanImportParsedRecipe = {
      key: "salad",
      title: "Salad B",
      serves: 4,
      ingredients: ["spinach"],
    };
    const merged = mergeCookbookRecipes([[a], [b]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.title).toBe("Salad A");
  });
});
