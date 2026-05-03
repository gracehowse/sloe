/**
 * healthImportLabels — N1 (2026-05-03) shared rules for HealthKit-import
 * fallback titles.
 *
 * Pins:
 *   - The new fallback string format (`<Source> entry · NNN kcal`) is
 *     stable. Mobile + web both call `formatHealthImportFallbackTitle`,
 *     so a copy change here ripples to both platforms automatically.
 *   - The predicate `isHealthImportFallbackTitle` matches BOTH the
 *     legacy `Food log (NNN kcal)` shape AND the new shape, so existing
 *     TestFlight user data keeps getting filtered out of "Eat again"
 *     and "Most-logged" surfaces after the fallback string changed.
 */
import { describe, expect, it } from "vitest";
import {
  formatHealthImportFallbackTitle,
  isHealthImportFallbackTitle,
} from "../../src/lib/nutrition/healthImportLabels";

describe("formatHealthImportFallbackTitle", () => {
  it("formats with the source app name + kcal", () => {
    expect(formatHealthImportFallbackTitle({ sourceApp: "MyFitnessPal", calories: 250 })).toBe(
      "MyFitnessPal entry · 250 kcal",
    );
    expect(formatHealthImportFallbackTitle({ sourceApp: "Lose It!", calories: 80 })).toBe(
      "Lose It! entry · 80 kcal",
    );
  });

  it("rounds non-integer calories", () => {
    expect(formatHealthImportFallbackTitle({ sourceApp: "MFP", calories: 249.7 })).toBe(
      "MFP entry · 250 kcal",
    );
  });

  it("clamps negative calories to 0 (defensive — should never happen)", () => {
    expect(formatHealthImportFallbackTitle({ sourceApp: "MFP", calories: -5 })).toBe(
      "MFP entry · 0 kcal",
    );
  });

  it("falls back to 'Apple Health' when source is empty / whitespace", () => {
    expect(formatHealthImportFallbackTitle({ sourceApp: "", calories: 100 })).toBe(
      "Apple Health entry · 100 kcal",
    );
    expect(formatHealthImportFallbackTitle({ sourceApp: "   ", calories: 100 })).toBe(
      "Apple Health entry · 100 kcal",
    );
  });

  it("treats NaN/Infinity calories as 0", () => {
    expect(formatHealthImportFallbackTitle({ sourceApp: "MFP", calories: NaN })).toBe(
      "MFP entry · 0 kcal",
    );
    expect(formatHealthImportFallbackTitle({ sourceApp: "MFP", calories: Infinity })).toBe(
      "MFP entry · 0 kcal",
    );
  });
});

describe("isHealthImportFallbackTitle", () => {
  describe("matches LEGACY shape (existing TestFlight user data)", () => {
    it("matches `Food log (NNN kcal)` exactly", () => {
      expect(isHealthImportFallbackTitle("Food log (250 kcal)")).toBe(true);
      expect(isHealthImportFallbackTitle("Food log (1 kcal)")).toBe(true);
      expect(isHealthImportFallbackTitle("Food log (9999 kcal)")).toBe(true);
    });

    it("is case-insensitive on the literal portions", () => {
      expect(isHealthImportFallbackTitle("FOOD LOG (250 KCAL)")).toBe(true);
      expect(isHealthImportFallbackTitle("food log (250 kcal)")).toBe(true);
    });

    it("tolerates surrounding whitespace", () => {
      expect(isHealthImportFallbackTitle("  Food log (250 kcal)  ")).toBe(true);
    });
  });

  describe("matches NEW shape (post-2026-05-03)", () => {
    it("matches `<Source> entry · NNN kcal`", () => {
      expect(isHealthImportFallbackTitle("MyFitnessPal entry · 250 kcal")).toBe(true);
      expect(isHealthImportFallbackTitle("Lose It! entry · 80 kcal")).toBe(true);
      expect(isHealthImportFallbackTitle("Apple Health entry · 1 kcal")).toBe(true);
      expect(isHealthImportFallbackTitle("Cronometer entry · 9999 kcal")).toBe(true);
    });

    it("matches with multi-word source names", () => {
      expect(isHealthImportFallbackTitle("MyFitnessPal Premium entry · 250 kcal")).toBe(true);
    });
  });

  describe("does NOT match real food names", () => {
    it("rejects plain food names", () => {
      expect(isHealthImportFallbackTitle("Chicken breast")).toBe(false);
      expect(isHealthImportFallbackTitle("Apple")).toBe(false);
      expect(isHealthImportFallbackTitle("Greek yoghurt")).toBe(false);
    });

    it("rejects similar-looking but different patterns", () => {
      // No "entry · NNN kcal" suffix → not a fallback.
      expect(isHealthImportFallbackTitle("MyFitnessPal entry")).toBe(false);
      // "Food log" without parenthesised kcal → could be a real recipe name.
      expect(isHealthImportFallbackTitle("Food log idea")).toBe(false);
      // Real-looking recipe with "entry" in the name.
      expect(isHealthImportFallbackTitle("My favourite entry")).toBe(false);
    });

    it("rejects empty / null / non-string input", () => {
      expect(isHealthImportFallbackTitle("")).toBe(false);
      expect(isHealthImportFallbackTitle("   ")).toBe(false);
      expect(isHealthImportFallbackTitle(null)).toBe(false);
      expect(isHealthImportFallbackTitle(undefined)).toBe(false);
    });
  });

  it("recognises every output of formatHealthImportFallbackTitle (round-trip)", () => {
    // Anything we construct should be filterable back out.
    const samples = [
      formatHealthImportFallbackTitle({ sourceApp: "MyFitnessPal", calories: 250 }),
      formatHealthImportFallbackTitle({ sourceApp: "Lose It!", calories: 80 }),
      formatHealthImportFallbackTitle({ sourceApp: "Cal AI", calories: 500 }),
      formatHealthImportFallbackTitle({ sourceApp: "", calories: 100 }),
    ];
    for (const sample of samples) {
      expect(isHealthImportFallbackTitle(sample)).toBe(true);
    }
  });
});
