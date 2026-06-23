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

  it("passes scaled macros into the macro section, not raw profile targets", () => {
    // ENG-1224: tiles/bars/rings now render through the extracted
    // <TodayMacroSection> switcher; it must receive the scaled targets.
    expect(HOST).toMatch(/dashboardMacroTargets/);
    expect(HOST).toMatch(
      /<TodayMacroSection[\s\S]*?targets=\{dashboardMacroTargets\}/,
    );
    expect(HOST).not.toMatch(
      /<TodayMacroSection[\s\S]*?targets=\{targets\}[\s\S]*?\/>/,
    );
  });
});
