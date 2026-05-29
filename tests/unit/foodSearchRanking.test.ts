import { describe, expect, it } from "vitest";

import {
  foodSearchRankScore,
  foodSearchTrustWeight,
  searchRelevance,
} from "@/lib/nutrition/foodSearchRanking";

describe("searchRelevance", () => {
  it("returns 1 for an exact normalized match", () => {
    expect(searchRelevance("Greek Yogurt", "greek yogurt")).toBe(1);
  });

  it("returns 0 when query or name is empty", () => {
    expect(searchRelevance("", "eggs")).toBe(0);
    expect(searchRelevance("eggs", "")).toBe(0);
  });

  it("ranks shorter exact-token hits above noisy long names", () => {
    const short = searchRelevance("eggs", "Eggs, Grade A, Large");
    const long = searchRelevance(
      "eggs",
      "Egg Substitute Powder With Added Vitamin D",
    );
    expect(short).toBeGreaterThan(long);
  });
});

describe("foodSearchTrustWeight", () => {
  it("boosts verified USDA and demotes generic OFF hardest", () => {
    expect(
      foodSearchTrustWeight({ source: "USDA", verified: true, name: "Eggs" }),
    ).toBe(0.1);
    expect(
      foodSearchTrustWeight({ source: "USDA", verified: false, name: "Eggs" }),
    ).toBe(-0.15);
    expect(
      foodSearchTrustWeight({ source: "OFF", name: "Brand · Product" }),
    ).toBe(-0.1);
    expect(
      foodSearchTrustWeight({ source: "OFF", name: "Generic Powder" }),
    ).toBe(-0.2);
  });

  it("applies the same commercial-source band to Edamam and FatSecret", () => {
    expect(
      foodSearchTrustWeight({ source: "Edamam", name: "McDonald's · Big Mac" }),
    ).toBe(-0.05);
    expect(
      foodSearchTrustWeight({ source: "FatSecret", name: "McDonald's · Big Mac" }),
    ).toBe(-0.05);
  });

  it("returns zero for custom or generic sources", () => {
    expect(foodSearchTrustWeight({ source: "CUSTOM", name: "My food" })).toBe(0);
  });
});

describe("foodSearchRankScore", () => {
  it("lets verified USDA beat a near-tie OFF row", () => {
    const usda = foodSearchRankScore({
      query: "eggs",
      name: "Eggs, Grade A, Large, egg whole",
      source: "USDA",
      verified: true,
    });
    const off = foodSearchRankScore({
      query: "eggs",
      name: "Brand · Eggs",
      source: "OFF",
    });
    expect(usda).toBeGreaterThan(off);
  });
});

describe("foodSearchPreviewPlausibilityWarning", () => {
  it("flags implausible per-100 g scaling in preview hosts", async () => {
    const { foodSearchPreviewPlausibilityWarning } = await import(
      "@/lib/nutrition/portionPicker"
    );
    const warning = foodSearchPreviewPlausibilityWarning(
      { calories: 100, protein: 10, carbs: 5, fat: 5 },
      { calories: 2625, protein: 250, carbs: 25, fat: 175 },
      500,
    );
    expect(warning).toEqual(expect.stringMatching(/looks unusually high/i));
  });

  it("returns null when there is no per-100 g basis", async () => {
    const { foodSearchPreviewPlausibilityWarning } = await import(
      "@/lib/nutrition/portionPicker"
    );
    expect(
      foodSearchPreviewPlausibilityWarning(null, { calories: 100, protein: 10 }, 100),
    ).toBeNull();
  });

  it("returns null when gram weight is zero", async () => {
    const { foodSearchPreviewPlausibilityWarning } = await import(
      "@/lib/nutrition/portionPicker"
    );
    expect(
      foodSearchPreviewPlausibilityWarning(
        { calories: 100, protein: 10, carbs: 0, fat: 0 },
        { calories: 100, protein: 10 },
        0,
      ),
    ).toBeNull();
  });
});
