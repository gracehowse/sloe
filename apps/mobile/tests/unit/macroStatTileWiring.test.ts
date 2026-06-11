/**
 * ENG-1014 — Today macro tiles delegate to the shared MacroStatTile leaf.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TODAY_TILES = readFileSync(
  resolve(__dirname, "../../components/today/TodayDashboardMacroTiles.tsx"),
  "utf8",
);
const PLAN_SUMMARY = readFileSync(
  resolve(__dirname, "../../components/plan/PlanDayMacroSummary.tsx"),
  "utf8",
);

describe("macro-stat unification wiring (ENG-1014)", () => {
  it("TodayDashboardMacroTiles renders MacroStatTile per tracked macro", () => {
    expect(TODAY_TILES).toMatch(/import \{ MacroStatTile \}/);
    expect(TODAY_TILES).toMatch(/<MacroStatTile/);
    expect(TODAY_TILES).not.toMatch(/macroStatCaption\(/);
  });

  it("PlanDayMacroSummary renders MacroStatPill cells", () => {
    expect(PLAN_SUMMARY).toMatch(/import \{ MacroStatPill \}/);
    expect(PLAN_SUMMARY).toMatch(/<MacroStatPill/);
  });
});
