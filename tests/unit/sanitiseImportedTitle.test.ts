/**
 * F-76 (2026-04-26) — pin sanitiseImportedTitle behaviour, including
 * the new "For [phrase]:" / "Recipe:" / "Recipe name:" stripping that
 * keeps caption-style section headings out of the title field.
 *
 * Existing protections (whitespace collapse, hashtag/URL tail strip,
 * 120-char cap, first-sentence preference) are pinned alongside so a
 * future refactor can't quietly remove them.
 */
import { describe, it, expect } from "vitest";
import {
  sanitiseImportedTitle,
  stripSectionPrefix,
} from "../../src/lib/recipe-import/extractSocialRecipe";

describe("sanitiseImportedTitle — F-76 caption-leak fixes", () => {
  it("strips leading 'For [phrase]:' section heading from titles", () => {
    expect(sanitiseImportedTitle("For the creamy cucumber salad: Banh Mi Bowl")).toBe(
      "Banh Mi Bowl",
    );
  });

  it("strips 'Recipe:' / 'Recipe name:' / 'Title:' / 'Dish:' lead-ins", () => {
    expect(sanitiseImportedTitle("Recipe: Banana bread")).toBe("Banana bread");
    expect(sanitiseImportedTitle("Recipe name: Lentil soup")).toBe("Lentil soup");
    expect(sanitiseImportedTitle("Title: Pad Thai")).toBe("Pad Thai");
    expect(sanitiseImportedTitle("Dish - Carbonara")).toBe("Carbonara");
  });

  it("returns null when the entire title was a section header (caller falls back)", () => {
    expect(sanitiseImportedTitle("For the creamy cucumber salad:")).toBe(null);
  });
});

describe("sanitiseImportedTitle — existing protections still pinned", () => {
  it("collapses internal whitespace and drops newlines", () => {
    expect(sanitiseImportedTitle("Banana   \n bread")).toBe("Banana bread");
  });

  it("strips trailing hashtag / @mention / URL tails", () => {
    expect(sanitiseImportedTitle("Banana bread #recipe @chef https://example.com")).toBe(
      "Banana bread",
    );
  });

  it("prefers the first sentence when caption has multiple", () => {
    expect(sanitiseImportedTitle("Banana bread. Easy and quick to make.")).toBe(
      "Banana bread.",
    );
  });

  it("returns null when the title exceeds the 120-char cap", () => {
    const long = "x".repeat(140);
    expect(sanitiseImportedTitle(long)).toBe(null);
  });

  it("returns null for null / empty / whitespace input", () => {
    expect(sanitiseImportedTitle(null)).toBe(null);
    expect(sanitiseImportedTitle("")).toBe(null);
    expect(sanitiseImportedTitle("   ")).toBe(null);
  });
});

describe("stripSectionPrefix — direct contract", () => {
  it("strips leading 'For [phrase]:' from ingredient strings", () => {
    expect(stripSectionPrefix("For the creamy cucumber salad: 1 tbsp miso")).toBe(
      "1 tbsp miso",
    );
  });

  it("leaves strings without the prefix unchanged", () => {
    expect(stripSectionPrefix("1 tbsp miso")).toBe("1 tbsp miso");
  });

  it("does not strip mid-string 'For X:' (only anchored at start)", () => {
    expect(stripSectionPrefix("Mix gently. For the dressing: whisk")).toBe(
      "Mix gently. For the dressing: whisk",
    );
  });
});
