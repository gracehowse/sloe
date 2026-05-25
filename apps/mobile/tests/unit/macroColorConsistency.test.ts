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

  it("sugar follows carbs (amber-orange — sugar is a carb)", () => {
    // 2026-05-25: carbs + sugar moved from Yellow to amber-orange
    // (#E8721E) so they de-collide from the activity/burn Yellow slot.
    expect(MacroColors.sugar.toLowerCase()).toBe("#e8721e");
    expect(MacroColors.sugar).toBe(MacroColors.carbs);
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

  it("carbs maps to amber-orange — distinct from sodium (de-collide)", () => {
    // 2026-05-25: carbs moved to amber-orange (#E8721E); the Yellow slot
    // it vacated is now the dedicated activity/burn token. The real
    // invariant is that carbs stays distinct from sodium's orange so the
    // two orange-family hues never read as the same role on one screen.
    expect(MacroColors.carbs).toBe(Accent.carbs);
    expect(MacroColors.carbs.toLowerCase()).toBe("#e8721e");
    expect(MacroColors.carbs).not.toBe(Accent.warning);
    expect(MacroColors.carbs).not.toBe(MacroColors.sodium);
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

  it("keeps macro identity colour on bars; captions stay neutral (2026-05-22 A2)", () => {
    expect(src).toMatch(/const barColor = def\.color/);
    expect(src).not.toMatch(/barColor = isOverBudget \? Accent\.(warning|destructive)/);
    expect(src).toMatch(/color: textTertiaryColor/);
    expect(src).not.toMatch(/isOverBudget \? overBudgetAmber/);
  });
});
