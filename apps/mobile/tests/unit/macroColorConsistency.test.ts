/**
 * Macro colours must not drift between tiles, rings, bars, and Settings.
 * Pins the shared resolver + Today tile wiring (2026-05-20).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MacroColors } from "../../constants/theme";
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

  it("sugar is damson (Sloe v3 — no longer follows carbs)", () => {
    // Sloe v3: sugar → damson (#6A4B7A), distinct from carbs (amber).
    expect(MacroColors.sugar.toLowerCase()).toBe("#6a4b7a");
    expect(MacroColors.sugar).not.toBe(MacroColors.carbs);
  });

  it("calories + fiber both sage; protein owns plum (Sloe v3 small palette)", () => {
    // Sloe v3 (2026-06-21): calories and fiber both render sage (#5E7C5A),
    // differentiated by icon + unit + position, not hue. Protein owns plum,
    // distinct from the sage ring.
    expect(MacroColors.calories.toLowerCase()).toBe("#5e7c5a");
    expect(MacroColors.fiber.toLowerCase()).toBe("#5e7c5a");
    expect(MacroColors.protein.toLowerCase()).toBe("#3b2a4d");
    expect(MacroColors.protein).not.toBe(MacroColors.calories);
  });

  it("carbs maps to amber — distinct from sodium (clay) + fat (berry-rose)", () => {
    // Sloe v3: carbs is amber; sodium is clay; fat is berry-rose. The invariant
    // is that carbs stays distinct from its neighbours so they never read as the
    // same role on one screen.
    expect(MacroColors.carbs.toLowerCase()).toBe("#c9892c");
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

  it("passes macro identity colour into MacroStatTile (ENG-1014)", () => {
    expect(src).toMatch(/color: macroColorFor\("/);
    expect(src).toMatch(/color=\{def\.color\}/);
    expect(src).toMatch(/<MacroStatTile/);
    expect(src).not.toMatch(/barColor = isOverBudget \? Accent\.(warning|destructive)/);
  });
});
