/**
 * F-76 (2026-04-26) + Build 41 follow-up (2026-05-01) — pin
 * sanitiseImportedTitle behaviour:
 *   - "For [phrase]:" / "Recipe:" / "Recipe name:" stripping keeps
 *     caption-style section headings out of the title field.
 *   - 80-char cap (was 120 — caption leak still happening on Build 40
 *     with one-sentence captions <120 chars).
 *   - First-clause / em-dash / " - " splitting for multi-clause
 *     captions like "Banana bread — the recipe that started it all".
 *   - Word-boundary clamp so titles never split mid-word.
 *   - Caption-shape rejection: input >240 chars with no structural
 *     separator returns null and lets the caller fall back to
 *     `meta.title` (also sanitised) or "Imported recipe".
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

  it("returns null when the title exceeds the 80-char cap with no clause breaks", () => {
    const long = "x".repeat(140);
    expect(sanitiseImportedTitle(long)).toBe(null);
  });

  it("returns null for null / empty / whitespace input", () => {
    expect(sanitiseImportedTitle(null)).toBe(null);
    expect(sanitiseImportedTitle("")).toBe(null);
    expect(sanitiseImportedTitle("   ")).toBe(null);
  });
});

describe("sanitiseImportedTitle — Build 41 (2026-05-01) follow-up", () => {
  it("400-char Instagram caption with no sentence breaks → null (caller falls back)", () => {
    // Single sprawling caption, only commas — no `.!?`. Longer than
    // CAPTION_SHAPE_REJECT_AT (240) so the early-out fires.
    const caption =
      "OMG you guys this banana bread is literally the best thing ive ever made in my life so so soft and moist with the perfect crumb and lots of chocolate chips on top its the perfect treat for a cozy sunday morning with a hot coffee and ill be making it every weekend from now on i promise you wont regret it";
    expect(sanitiseImportedTitle(caption)).toBe(null);
  });

  it("multi-clause caption keeps the first clause when ≥3 commas (caption shape)", () => {
    expect(
      sanitiseImportedTitle(
        "The best banana bread, super moist, takes 1 hour, perfect for breakfast",
      ),
    ).toBe("The best banana bread");
  });

  it("em-dash tagline is split — first segment kept", () => {
    expect(
      sanitiseImportedTitle("Banana bread — the recipe that started it all"),
    ).toBe("Banana bread");
  });

  it("clamps long single-sentence titles to a word boundary, not mid-word", () => {
    const t =
      "Sheet pan harissa chicken with chickpeas and roasted red peppers tossed with lemon yogurt sauce";
    const result = sanitiseImportedTitle(t);
    if (result != null) {
      expect(result.length).toBeLessThanOrEqual(80);
      expect(result).toMatch(/\w$/);
      expect(t).toContain(result);
    }
    // Never a mid-word truncation.
    expect(result).not.toMatch(/\b\w{1,3}$/);
  });

  it("80-char limit: titles ≤80 chars pass through unchanged", () => {
    expect(sanitiseImportedTitle("Sheet-pan harissa chicken with chickpeas")).toBe(
      "Sheet-pan harissa chicken with chickpeas",
    );
    expect(
      sanitiseImportedTitle("Slow-cooked beef ragu with pappardelle and parmesan"),
    ).toBe("Slow-cooked beef ragu with pappardelle and parmesan");
  });

  it("punctuation-only suffix on the clamped slice is trimmed", () => {
    const t =
      "The best banana bread, super moist, takes one hour, perfect for breakfast or weekend brunch with a strong coffee";
    const result = sanitiseImportedTitle(t);
    if (result != null) {
      expect(result).not.toMatch(/[,;:\-—]$/);
    }
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
