/**
 * Tests for nutrition source classification used in the NutritionSourceBadge component.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { classifySource } from "@/components/NutritionSourceBadge";

describe("classifySource", () => {
  it("classifies USDA sources as verified", () => {
    expect(classifySource("USDA FoodData Central")).toBe("verified");
    expect(classifySource("USDA")).toBe("verified");
    expect(classifySource("FDC")).toBe("verified");
  });

  it("classifies Open Food Facts as verified", () => {
    expect(classifySource("Open Food Facts")).toBe("verified");
    expect(classifySource("openfoodfacts")).toBe("verified");
    expect(classifySource("off")).toBe("verified");
  });

  it("classifies FatSecret as verified", () => {
    expect(classifySource("FatSecret")).toBe("verified");
    expect(classifySource("fatsecret")).toBe("verified");
  });

  it("classifies Edamam as verified", () => {
    // Edamam is a paid nutrition API — its rows are as authoritative as the
    // other database sources. Previously misclassified as manual which
    // broke the Edamam attribution path at point of use.
    expect(classifySource("Edamam")).toBe("verified");
    expect(classifySource("edamam")).toBe("verified");
  });

  it("classifies AI/photo sources as estimated", () => {
    expect(classifySource("AI photo")).toBe("estimated");
    expect(classifySource("voice")).toBe("estimated");
    expect(classifySource("Recipe import")).toBe("estimated");
    expect(classifySource("OpenAI")).toBe("estimated");
  });

  it("classifies manual entries", () => {
    expect(classifySource("Meal plan")).toBe("manual");
    expect(classifySource("Manual entry")).toBe("manual");
    expect(classifySource("")).toBe("manual");
    expect(classifySource(null)).toBe("manual");
    expect(classifySource(undefined)).toBe("manual");
  });
});

// ── ENG-716 token sweep — the badge palette must trace to semantic tokens ────

/** Strip `//` line + `/* *​/` block comments so negative literal-assertions
 *  test the actual CODE, not explanatory comments that legitimately reference
 *  the old literal or a token's hex value (matches the recipeEditTokenSweep
 *  comment-stripping pattern). */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("NutritionSourceBadge token discipline (ENG-716)", () => {
  const webSrc = () =>
    readFileSync(resolve(__dirname, "../../src/components/NutritionSourceBadge.tsx"), "utf8");
  const mobileSrc = () =>
    readFileSync(
      resolve(__dirname, "../../apps/mobile/components/NutritionSourceBadge.tsx"),
      "utf8",
    );

  it("web badge uses the Sloe semantic state tokens, not raw palette literals", () => {
    const src = webSrc();
    expect(src).toMatch(/bg-success-soft text-success-solid/);
    expect(src).toMatch(/bg-warning-soft text-warning-solid/);
    expect(src).toMatch(/bg-muted text-muted-foreground/);
    // The old raw Tailwind palette literals are gone (code only).
    const code = codeOnly(src);
    expect(code).not.toMatch(/bg-green-\d/);
    expect(code).not.toMatch(/text-green-\d/);
    expect(code).not.toMatch(/bg-yellow-\d/);
    expect(code).not.toMatch(/text-yellow-\d/);
    expect(code).not.toMatch(/bg-slate-\d/);
    expect(code).not.toMatch(/text-slate-\d/);
  });

  it("mobile badge has no hardcoded hex — manual reads the sourceManual token", () => {
    const src = mobileSrc();
    // The cool-slate literal is gone; manual now reads the warm-grey
    // provenance token, dark-swapping via useThemeColors. (Comments may cite
    // token hex values for documentation — assert against code only.)
    const code = codeOnly(src);
    expect(code).not.toMatch(/#94a3b8/i);
    expect(code).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    expect(src).toMatch(/colors\.sourceManual/);
    expect(src).toMatch(/useThemeColors/);
    // Verified/estimated stay on the static Accent fills (value preserved).
    expect(src).toMatch(/Accent\.success/);
    expect(src).toMatch(/Accent\.warning/);
  });
});
