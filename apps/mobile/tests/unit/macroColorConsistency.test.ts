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

  it("sugar follows carbs (clay — sugar is a carb)", () => {
    // Sloe Phase 0: carbs + sugar are clay (#C8794E).
    expect(MacroColors.sugar.toLowerCase()).toBe("#c8794e");
    expect(MacroColors.sugar).toBe(MacroColors.carbs);
  });

  it("calories is plum and fiber is teal (Sloe — distinct hues)", () => {
    // Sloe Phase 0 (dossier): the calorie ring owns plum (chrome hue); fiber
    // is teal. They are NO LONGER the same hue (the old 8-slot palette folded
    // both onto green). Icon + unit still differentiate from neighbours.
    expect(MacroColors.calories.toLowerCase()).toBe("#3b2a4d");
    expect(MacroColors.fiber.toLowerCase()).toBe("#4a7878");
    expect(MacroColors.fiber).toBe(Accent.fiber);
    expect(MacroColors.calories).not.toBe(MacroColors.fiber);
  });

  it("carbs maps to clay — distinct from sodium + fat", () => {
    // Sloe Phase 0: carbs is clay; sodium is honey; fat is amber. The
    // invariant is that carbs stays distinct from its warm-hue neighbours so
    // they never read as the same role on one screen.
    expect(MacroColors.carbs).toBe(Accent.carbs);
    expect(MacroColors.carbs.toLowerCase()).toBe("#c8794e");
    expect(MacroColors.carbs).not.toBe(MacroColors.sodium);
    expect(MacroColors.carbs).not.toBe(MacroColors.fat);
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
