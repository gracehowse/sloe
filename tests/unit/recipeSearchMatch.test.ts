/**
 * Polish (2026-04-25) — Discover search tokenisation contract.
 *
 * Bug pinned: pre-fix Discover search did `title.toLowerCase().includes(q)`,
 * so "wasabi katsu curry" returned no results when the title was "Katsu Curry
 * by Wasabi". The new helper tokenises the query and requires every token to
 * appear somewhere across title + description + creator + source.
 */
import { describe, it, expect } from "vitest";
import { recipeSearchMatch } from "../../src/lib/recipes/recipeSearchMatch";

const wasabiCurry = {
  title: "Katsu Curry",
  creatorName: "Wasabi",
  description: "Restaurant-style Japanese curry",
};

describe("recipeSearchMatch", () => {
  it("matches when every query token appears across the haystack", () => {
    expect(recipeSearchMatch(wasabiCurry, "wasabi katsu curry")).toBe(true);
    expect(recipeSearchMatch(wasabiCurry, "katsu wasabi")).toBe(true);
    expect(recipeSearchMatch(wasabiCurry, "japanese curry")).toBe(true);
  });

  it("matches the title-only contiguous case (regression check)", () => {
    expect(recipeSearchMatch(wasabiCurry, "katsu curry")).toBe(true);
  });

  it("returns false when any token is missing across all fields", () => {
    expect(recipeSearchMatch(wasabiCurry, "wasabi katsu pizza")).toBe(false);
    expect(recipeSearchMatch(wasabiCurry, "thai curry")).toBe(false);
  });

  it("is case-insensitive and ignores punctuation", () => {
    expect(recipeSearchMatch(wasabiCurry, "WASABI, KATSU.")).toBe(true);
    expect(recipeSearchMatch({ title: "Mom's Lasagna" }, "moms lasagna")).toBe(true);
  });

  it("returns true for an empty / whitespace-only query (no filter)", () => {
    expect(recipeSearchMatch(wasabiCurry, "")).toBe(true);
    expect(recipeSearchMatch(wasabiCurry, "   ")).toBe(true);
  });

  it("returns false for an empty haystack with a non-empty query", () => {
    expect(recipeSearchMatch({}, "anything")).toBe(false);
  });

  it("treats tags as searchable", () => {
    const taggedRecipe = {
      title: "Quick Snack",
      tags: ["high-protein", "vegan"],
    };
    expect(recipeSearchMatch(taggedRecipe, "vegan snack")).toBe(true);
    expect(recipeSearchMatch(taggedRecipe, "high protein")).toBe(true);
  });
});
