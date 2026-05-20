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

  it("sugar is periwinkle — not warning amber", () => {
    expect(MacroColors.sugar).toBe(Accent.primaryLight);
    expect(MacroColors.sugar).not.toBe(Accent.warning);
  });

  it("fiber green is distinct from calories / success green", () => {
    expect(MacroColors.fiber).toBe(Accent.fiber);
    expect(MacroColors.calories).toBe(Accent.success);
    expect(MacroColors.fiber).not.toBe(MacroColors.calories);
    expect(MacroColors.fiber.toLowerCase()).toBe("#4a7878");
    expect(MacroColors.calories.toLowerCase()).toBe("#62b35a");
  });

  it("carbs is yellow-orange — not warning amber or sodium orange", () => {
    expect(MacroColors.carbs).toBe(Accent.carbs);
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

  it("keeps macro identity colour on over-budget bars (caption uses destructive)", () => {
    expect(src).toMatch(/const barColor = def\.color/);
    expect(src).not.toMatch(/barColor = isOverBudget \? Accent\.warning/);
    expect(src).toMatch(/isOverBudget \? Accent\.destructive/);
  });
});
