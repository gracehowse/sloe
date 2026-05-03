/**
 * Source-pin: web `NutritionTracker` (the Today composition root)
 * does not import or render the deleted `TodayMicrosWidget` after the
 * 2026-05-02 revert of PR #30, AND it now renders the
 * `FullNutrientPanelSheet` from PR #47 wired to
 * `TodayDashboardMacroTiles`'s "View all N nutrients" pill.
 *
 * This is a source-level pin (rather than a render test) because
 * NutritionTracker is the same kind of composition root as the
 * mobile Today host — rendering it in a unit suite would require
 * stubbing dozens of Supabase / Stripe / PostHog modules.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SRC_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "src",
  "app",
  "components",
  "NutritionTracker.tsx",
);

describe("NutritionTracker (web Today) — post-revert (2026-05-02)", () => {
  it("does NOT import or render TodayMicrosWidget", () => {
    const SRC = readFileSync(SRC_PATH, "utf8");
    expect(SRC).not.toMatch(/from ["'][^"']*today-micros-widget["']/);
    expect(SRC).not.toMatch(/<TodayMicrosWidget\b/);
  });

  it("imports FullNutrientPanelSheet (PR #47 panel kept)", () => {
    const SRC = readFileSync(SRC_PATH, "utf8");
    expect(SRC).toMatch(/from ["'][^"']*full-nutrient-panel-sheet["']/);
    expect(SRC).toMatch(/<FullNutrientPanelSheet\b/);
  });

  it("wires TodayDashboardMacroTiles' onPressViewAllNutrients to open the panel", () => {
    const SRC = readFileSync(SRC_PATH, "utf8");
    expect(SRC).toMatch(/onPressViewAllNutrients=\{\(\) => setFullNutrientPanelOpen\(true\)\}/);
  });
});
