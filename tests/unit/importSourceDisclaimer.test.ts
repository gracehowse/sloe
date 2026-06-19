/**
 * ENG-858 / ENG-1042 — the import source-card disclaimer is a single shared
 * constant (legal-approved wording) used by both platforms. This pins the gate
 * predicate and the exact wording so a future edit either keeps the
 * legally-required content or surfaces the change here for the legal lens.
 *
 * Wording source: docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md
 * ("Exact wording" §). Body-neutral, factual, no health claims.
 */
import { describe, it, expect } from "vitest";
import {
  isImportedRecipe,
  importSourceDisclaimer,
} from "@/lib/recipes/importSourceDisclaimer";

describe("isImportedRecipe — disclaimer gate", () => {
  it("is true when a source URL is present (the canonical import signal)", () => {
    expect(isImportedRecipe({ sourceUrl: "https://example.com/r", sourceName: null })).toBe(true);
  });

  it("is true when only a source name is present (caption-recovered handle)", () => {
    expect(isImportedRecipe({ sourceUrl: null, sourceName: "@chef" })).toBe(true);
  });

  it("is false for a first-party recipe with no source", () => {
    expect(isImportedRecipe({ sourceUrl: null, sourceName: null })).toBe(false);
    expect(isImportedRecipe({})).toBe(false);
  });

  it("treats whitespace-only source values as absent", () => {
    expect(isImportedRecipe({ sourceUrl: "   ", sourceName: "  " })).toBe(false);
  });
});

describe("importSourceDisclaimer — legal-approved wording", () => {
  it("names the source in the non-endorsement clause when known", () => {
    const text = importSourceDisclaimer("Smitten Kitchen");
    expect(text).toBe(
      "Recipe imported for your personal cookbook. Ingredients and nutrition are estimated by Sloe and may differ from the original. Not affiliated with or endorsed by Smitten Kitchen.",
    );
  });

  it("includes the three legally-required clauses (personal copy / estimated / no endorsement)", () => {
    const text = importSourceDisclaimer("@chef");
    expect(text).toContain("imported for your personal cookbook");
    expect(text).toContain("estimated by Sloe and may differ from the original");
    expect(text).toContain("Not affiliated with or endorsed by @chef");
  });

  it("falls back to a neutral subject when no source name is known (never invents one)", () => {
    const text = importSourceDisclaimer(null);
    expect(text).toContain("Not affiliated with or endorsed by the original source.");
    // No fabricated handle / domain.
    expect(text).not.toMatch(/@|https?:\/\//);
  });

  it("is body-neutral: no health claims, no value judgement", () => {
    const text = importSourceDisclaimer("Source").toLowerCase();
    for (const banned of ["healthy", "guilt", "cheat", "bad", "good for you", "lose weight"]) {
      expect(text).not.toContain(banned);
    }
  });
});
