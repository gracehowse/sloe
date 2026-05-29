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

  it("falls back to overlapping windows when there are no page breaks", () => {
    const text = "a".repeat(45_000);
    const chunks = chunkTextForCookbookParse(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.length).toBeLessThanOrEqual(40_000);
    expect(chunks.join("").length).toBeGreaterThan(text.length - 5_000);
  });

  it("merges small form-feed pages into a single chunk when under the cap", () => {
    const pageA = "Recipe A\n".repeat(100);
    const pageB = "Recipe B\n".repeat(100);
    const chunks = chunkTextForCookbookParse(`${pageA}\f${pageB}`);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("Recipe A");
    expect(chunks[0]).toContain("Recipe B");
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
