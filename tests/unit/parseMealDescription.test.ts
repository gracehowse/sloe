import { describe, expect, it } from "vitest";
import { looksLikeMealDescription } from "../../src/lib/nutrition/parseMealDescription";

describe("looksLikeMealDescription", () => {
  it("returns false for short brand-style queries", () => {
    expect(looksLikeMealDescription("oats")).toBe(false);
    expect(looksLikeMealDescription("chicken")).toBe(false);
  });

  it("returns true for multi-word meal sentences", () => {
    expect(looksLikeMealDescription("two eggs and toast")).toBe(true);
  });

  it("returns true for portion + food pairs with digits", () => {
    expect(looksLikeMealDescription("200g chicken")).toBe(true);
  });

  it("returns true for common meal connective words", () => {
    expect(looksLikeMealDescription("coffee with oat milk")).toBe(true);
  });
});
