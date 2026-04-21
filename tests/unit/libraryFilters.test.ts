import { describe, expect, it } from "vitest";
import {
  LIBRARY_FILTER_PILLS,
  isHighProtein,
  isQuick,
  isVegetarianByTitle,
  matchesNutritionPill,
  HIGH_PROTEIN_G,
  QUICK_TOTAL_MIN,
} from "../../src/lib/recipes/libraryFilters";

const R = (partial: Partial<{
  title: string;
  protein: number;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
}>) => ({
  title: partial.title ?? "Untitled",
  protein: partial.protein ?? 0,
  prepTimeMin: partial.prepTimeMin ?? null,
  cookTimeMin: partial.cookTimeMin ?? null,
});

describe("libraryFilters — LIBRARY_FILTER_PILLS", () => {
  it("matches prototype ordering (All / Saved / High-Protein / Quick / Vegetarian) followed by Created / Imported", () => {
    expect(LIBRARY_FILTER_PILLS.map((p) => p.id)).toEqual([
      "all",
      "saved",
      "high-protein",
      "quick",
      "vegetarian",
      "created",
      "imported",
    ]);
  });

  it("tags entry-kind pills as isEntryKind:true and nutrition pills as false", () => {
    const byId = Object.fromEntries(LIBRARY_FILTER_PILLS.map((p) => [p.id, p.isEntryKind]));
    expect(byId.all).toBe(true);
    expect(byId.saved).toBe(true);
    expect(byId.created).toBe(true);
    expect(byId.imported).toBe(true);
    expect(byId["high-protein"]).toBe(false);
    expect(byId.quick).toBe(false);
    expect(byId.vegetarian).toBe(false);
  });
});

describe("libraryFilters — isHighProtein", () => {
  it(`returns true at and above ${HIGH_PROTEIN_G}g protein`, () => {
    expect(isHighProtein(R({ protein: HIGH_PROTEIN_G }))).toBe(true);
    expect(isHighProtein(R({ protein: HIGH_PROTEIN_G + 5 }))).toBe(true);
  });
  it("returns false below the threshold", () => {
    expect(isHighProtein(R({ protein: HIGH_PROTEIN_G - 1 }))).toBe(false);
    expect(isHighProtein(R({ protein: 0 }))).toBe(false);
  });
  it("returns false for NaN protein (bad data shouldn't flood the pill)", () => {
    expect(isHighProtein(R({ protein: Number.NaN }))).toBe(false);
  });
});

describe("libraryFilters — isQuick", () => {
  it(`returns true when prep + cook ≤ ${QUICK_TOTAL_MIN} min and at least one is set`, () => {
    expect(isQuick(R({ prepTimeMin: 10, cookTimeMin: 15 }))).toBe(true);
    expect(isQuick(R({ prepTimeMin: 0, cookTimeMin: QUICK_TOTAL_MIN }))).toBe(true);
    expect(isQuick(R({ prepTimeMin: QUICK_TOTAL_MIN, cookTimeMin: null }))).toBe(true);
  });
  it("returns false when prep + cook exceed threshold", () => {
    expect(isQuick(R({ prepTimeMin: 20, cookTimeMin: 20 }))).toBe(false);
  });
  it("returns false when both times are missing (no legacy-row free pass)", () => {
    expect(isQuick(R({ prepTimeMin: null, cookTimeMin: null }))).toBe(false);
    expect(isQuick(R({ prepTimeMin: 0, cookTimeMin: 0 }))).toBe(false);
  });
});

describe("libraryFilters — isVegetarianByTitle", () => {
  it("accepts titles with no meat / fish keywords", () => {
    expect(isVegetarianByTitle(R({ title: "Mushroom risotto" }))).toBe(true);
    expect(isVegetarianByTitle(R({ title: "Paneer tikka" }))).toBe(true);
    expect(isVegetarianByTitle(R({ title: "Chickpea curry" }))).toBe(true);
  });
  it("rejects titles with meat keywords", () => {
    expect(isVegetarianByTitle(R({ title: "Sheet-pan chicken bowl" }))).toBe(false);
    expect(isVegetarianByTitle(R({ title: "Beef tacos" }))).toBe(false);
    expect(isVegetarianByTitle(R({ title: "Salmon poke" }))).toBe(false);
    expect(isVegetarianByTitle(R({ title: "Bacon carbonara" }))).toBe(false);
  });
  it("rejects empty or whitespace-only titles (we don't assume)", () => {
    expect(isVegetarianByTitle(R({ title: "" }))).toBe(false);
    expect(isVegetarianByTitle(R({ title: "   " }))).toBe(false);
  });
});

describe("libraryFilters — matchesNutritionPill", () => {
  it("returns true for entry-kind pills (caller handles those)", () => {
    expect(matchesNutritionPill("all", R({ protein: 0, title: "Beef stew" }))).toBe(true);
    expect(matchesNutritionPill("saved", R({ protein: 0, title: "Beef stew" }))).toBe(true);
    expect(matchesNutritionPill("created", R({ protein: 0, title: "Beef stew" }))).toBe(true);
    expect(matchesNutritionPill("imported", R({ protein: 0, title: "Beef stew" }))).toBe(true);
  });
  it("delegates to each predicate for the nutrition pills", () => {
    expect(matchesNutritionPill("high-protein", R({ protein: 40 }))).toBe(true);
    expect(matchesNutritionPill("high-protein", R({ protein: 10 }))).toBe(false);
    expect(matchesNutritionPill("quick", R({ prepTimeMin: 10, cookTimeMin: 10 }))).toBe(true);
    expect(matchesNutritionPill("quick", R({ prepTimeMin: 30, cookTimeMin: 30 }))).toBe(false);
    expect(matchesNutritionPill("vegetarian", R({ title: "Tofu stir-fry" }))).toBe(true);
    expect(matchesNutritionPill("vegetarian", R({ title: "Tuna salad" }))).toBe(false);
  });
});
