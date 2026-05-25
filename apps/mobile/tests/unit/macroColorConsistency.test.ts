/**
 * Macro colours must not drift between tiles, rings, bars, and Settings.
 * Pins the shared resolver + Today tile wiring (2026-05-20).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Accent, MacroColors } from "../../constants/theme";
import { macroColorFor } from "../../lib/macroColors";

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

describe("macroColorFor — canonical palette", () => {
  it("maps each tracked macro to MacroColors", () => {
    expect(macroColorFor("protein")).toBe(MacroColors.protein);
    expect(macroColorFor("carbs")).toBe(MacroColors.carbs);
    expect(macroColorFor("fat")).toBe(MacroColors.fat);
    expect(macroColorFor("fiber")).toBe(MacroColors.fiber);
    expect(macroColorFor("sugar")).toBe(MacroColors.sugar);
    expect(macroColorFor("sodium")).toBe(MacroColors.sodium);
    expect(macroColorFor("water")).toBe(MacroColors.water);
  });

  it("sugar maps to Yellow (8-slot — sugar is a carb)", () => {
    // 2026-05-22 evening: sugar folded into Yellow slot. Was periwinkle.
    expect(MacroColors.sugar.toLowerCase()).toBe("#f3c336");
    expect(MacroColors.sugar).not.toBe(Accent.warning);
  });

  it("fiber and calories both map to Green slot (icons differentiate)", () => {
    // 2026-05-22 evening: 8-slot palette consolidates fiber + calories
    // onto Green. The Beef vs Leaf icon + the kcal-vs-g unit are the
    // differentiators on tiles + rings; colour parity is intentional.
    expect(MacroColors.fiber).toBe(Accent.fiber);
    expect(MacroColors.calories).toBe(Accent.success);
    expect(MacroColors.fiber.toLowerCase()).toBe("#56a775");
    expect(MacroColors.calories.toLowerCase()).toBe("#56a775");
  });

  it("carbs maps to Yellow — not Orange (Orange reserved for activity/bonus)", () => {
    expect(MacroColors.carbs).toBe(Accent.carbs);
    expect(MacroColors.carbs.toLowerCase()).toBe("#f3c336");
    expect(MacroColors.carbs).not.toBe(Accent.warning);
    expect(MacroColors.carbs).not.toBe(Accent.orange);
  });
});

describe("ScreenSectionChrome — Layout import", () => {
  const chromeSrc = read("apps/mobile/components/suppr/screen-section-chrome.tsx");

  it("imports Layout from constants/layout (not theme — Layout is not on theme)", () => {
    expect(chromeSrc).toMatch(/from "@\/constants\/layout"/);
    expect(chromeSrc).not.toMatch(
      /import\s*\{[^}]*\bLayout\b[^}]*\}\s*from\s*"@\/constants\/theme"/,
    );
  });
});

describe("TodayDashboardMacroTiles — uses macroColorFor", () => {
  const src = read("apps/mobile/components/today/TodayDashboardMacroTiles.tsx");

  it("imports macroColorFor", () => {
    expect(src).toContain('from "@/lib/macroColors"');
    expect(src).toContain("macroColorFor(");
  });

  it("does not assign warning amber to sugar tile colour", () => {
    expect(src).not.toMatch(/sugar:[\s\S]*?color:\s*Accent\.warning/);
  });

  it("keeps macro identity colour on over-budget bars (caption uses over-budget amber)", () => {
    // 2026-05-21: over-budget caption is amber (Accent.warning), never
    // red. Per brand-tokens.md + project memory ("over-budget is amber,
    // never red"). The bar itself still uses the macro identity colour
    // (def.color); only the caption flips to amber to signal "over".
    expect(src).toMatch(/const barColor = def\.color/);
    expect(src).not.toMatch(/barColor = isOverBudget \? Accent\.(warning|destructive)/);
    expect(src).toMatch(/isOverBudget \? overBudgetAmber/);
    // Defense in depth: the file should NOT use destructive for an
    // over-budget caption — that was the old alarming pattern.
    expect(src).not.toMatch(/isOverBudget \? Accent\.destructive/);
  });
});
