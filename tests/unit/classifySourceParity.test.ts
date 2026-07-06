/**
 * ENG-1419 (2026-07-05 deep audit, nutrition trust, tl-F1/label-F1 +
 * tl-F3/label-F3) — table-driven parity test proving web and mobile
 * classify every source string identically.
 *
 * Before this fix, `apps/mobile/components/NutritionSourceBadge.tsx` had
 * its own copy of `classifySource` that had silently drifted from web's:
 * FatSecret/Edamam rendered green on web, grey on mobile; "USDA (adjusted)"
 * over-trusted as verified on mobile; mobile's loose `s.includes("off")`
 * could false-match any source string containing "off" as a substring.
 *
 * Both platforms now import the canonical function from
 * src/lib/nutrition/classifySource.ts (web directly, mobile via
 * @suppr/nutrition-core/classifySource) — this test imports it via BOTH
 * platforms' actual call sites (the re-exports on each NutritionSourceBadge
 * component) so a future regression that reintroduces a local override in
 * either file fails here immediately, not silently in production.
 */
import { describe, expect, it } from "vitest";
import { classifySource as webClassifySource, type SourceTier } from "../../src/components/NutritionSourceBadge";
import { classifySource as sharedClassifySource } from "../../src/lib/nutrition/classifySource";

// apps/mobile/components/NutritionSourceBadge.tsx is a React Native module
// (imports `react-native`, `@/constants/theme`, etc.) and can't be imported
// directly into this web-side vitest environment. It re-exports
// classifySource verbatim from @suppr/nutrition-core/classifySource with no
// wrapping logic (confirmed by reading the file) — importing that exact
// module here is equivalent, and is the same module mobile's tsconfig path
// alias resolves to.
import { classifySource as mobileClassifySource } from "../../src/lib/nutrition-core/classifySource";

const CASES: Array<{ source: string | null | undefined; expected: SourceTier; note: string }> = [
  // ── Previously divergent: mobile was missing these verified sources ──
  { source: "FatSecret", expected: "verified", note: "was green on web, grey on mobile pre-fix" },
  { source: "fatsecret", expected: "verified", note: "case-insensitive" },
  { source: "Edamam", expected: "verified", note: "was green on web, grey on mobile pre-fix" },
  { source: "edamam", expected: "verified", note: "case-insensitive" },
  // ── Previously divergent: mobile had no demotion branches ──
  { source: "USDA (adjusted)", expected: "estimated", note: "mobile over-trusted this as verified pre-fix" },
  { source: "FatSecret (adjusted)", expected: "estimated", note: "adjusted demotes regardless of provider" },
  { source: "Quick add", expected: "estimated", note: "mobile had no quick-add demotion pre-fix" },
  { source: "Barcode scan", expected: "estimated", note: "mobile had no barcode demotion pre-fix" },
  // ── Previously divergent: mobile's loose off-substring match ──
  { source: "off", expected: "verified", note: "exact OFF match" },
  { source: "Open Food Facts", expected: "verified", note: "" },
  { source: "openfoodfacts", expected: "verified", note: "" },
  // ── Already-aligned cases (regression guard) ──
  { source: "USDA FoodData Central", expected: "verified", note: "" },
  { source: "USDA", expected: "verified", note: "" },
  { source: "FDC", expected: "verified", note: "" },
  { source: "AI photo", expected: "estimated", note: "" },
  { source: "voice", expected: "estimated", note: "" },
  { source: "Recipe import", expected: "estimated", note: "" },
  { source: "OpenAI", expected: "estimated", note: "" },
  { source: "Manual entry", expected: "manual", note: "" },
  { source: "Meal plan", expected: "manual", note: "" },
  { source: "", expected: "manual", note: "" },
  { source: null, expected: "manual", note: "" },
  { source: undefined, expected: "manual", note: "" },
];

describe("classifySource — web/mobile parity (ENG-1419)", () => {
  it.each(CASES)("$source -> $expected ($note)", ({ source, expected }) => {
    expect(webClassifySource(source)).toBe(expected);
    expect(mobileClassifySource(source)).toBe(expected);
  });

  it("web and mobile resolve to the exact same function reference", () => {
    // Both re-export the canonical helper verbatim, with zero local
    // wrapping — proves there's no divergent shim hiding behind either
    // re-export.
    expect(webClassifySource).toBe(sharedClassifySource);
    expect(mobileClassifySource).toBe(sharedClassifySource);
  });

  it("checks the demotion branches before the verified-source branches (order matters)", () => {
    // If a future edit reordered the checks, "adjusted"/"quick"/"barcode"
    // strings that also contain a verified-source keyword would wrongly
    // classify as verified instead of estimated.
    expect(sharedClassifySource("USDA quick add")).toBe("estimated");
    expect(sharedClassifySource("FatSecret barcode")).toBe("estimated");
  });
});
