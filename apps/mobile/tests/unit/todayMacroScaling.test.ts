import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HOST = readFileSync(
  resolve(__dirname, "../../app/(tabs)/_today/TodayScreen.tsx"),
  "utf8",
);

describe("Today macro scaling (activity bonus)", () => {
  it("uses scaleMacroTargetsForCalorieBudget for effectiveMacroTargets", () => {
    expect(HOST).toMatch(/scaleMacroTargetsForCalorieBudget/);
    expect(HOST).toMatch(/effectiveMacroTargets/);
  });

  it("passes scaled macros into dashboard tiles and bars, not raw profile targets", () => {
    expect(HOST).toMatch(/dashboardMacroTargets/);
    expect(HOST).toMatch(
      /<TodayDashboardMacroTiles[\s\S]*?targets=\{dashboardMacroTargets\}/,
    );
    expect(HOST).toMatch(
      /<TodayDashboardMacroBars[\s\S]*?targets=\{dashboardMacroTargets\}/,
    );
    expect(HOST).not.toMatch(
      /<TodayDashboardMacroTiles[\s\S]*?targets=\{targets\}/,
    );
    expect(HOST).not.toMatch(
      /<TodayDashboardMacroBars[\s\S]*?targets=\{targets\}/,
    );
  });
});
