/**
 * Build-12 H-5 mobile pin — TestFlight `AH8csBqtZsBJJr0uHgXyEcE`.
 * The Plan tab's new "Day total · X / Y kcal · P / C / F" line must
 * come from the shared helper (no reinvented totals math) and must be
 * tagged with a per-day testID that matches the web side so Maestro /
 * Playwright selectors stay portable.
 *
 * Sits alongside the root-level `tests/unit/dayTotalVsGoalLineRender.test.ts`
 * — web-authored tests can't see mobile-only paths during CI shards,
 * so this duplicate pin makes the mobile run fail loudly if someone
 * drops the helper import from the tab file.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildDayTotalVsGoalLine,
  classifyDayDelta,
  formatDayTotalCell,
} from "../../../../src/lib/planning/dayTotalVsGoal";

const PLANNER_PATH = resolve(__dirname, "../../app/(tabs)/planner.tsx");
const PLANNER_SRC = readFileSync(PLANNER_PATH, "utf8");

describe("mobile planner — day total vs goal wiring", () => {
  it("imports the shared helper from src/lib/planning/dayTotalVsGoal", () => {
    expect(PLANNER_SRC).toMatch(
      /from\s+["'][^"']*src\/lib\/planning\/dayTotalVsGoal["']/,
    );
    expect(PLANNER_SRC).toMatch(/\bbuildDayTotalVsGoalLine\b/);
    expect(PLANNER_SRC).toMatch(/\bformatDayTotalCell\b/);
    expect(PLANNER_SRC).toMatch(/\bDayTotalTone\b/);
  });

  it("tags the summary row with a per-day testID (Maestro-friendly)", () => {
    expect(PLANNER_SRC).toMatch(/testID=\{`day-total-vs-goal-\$\{dp\.day\}`\}/);
  });

  it("omits the line when hasTargets=false (new account)", () => {
    // The JSX guard must check both `goalLine` truthiness AND
    // `goalLine.hasTargets`. A direct render without the guard would
    // show `0 / 0` for new users, which the spec forbids.
    expect(PLANNER_SRC).toMatch(/goalLine\s*&&\s*goalLine\.hasTargets/);
  });

  it("has a tone → colour map covering all three classifications", () => {
    // Keep the mapping close to the JSX so the test fails if a future
    // refactor deletes one branch by accident.
    expect(PLANNER_SRC).toMatch(
      /tone === "neutral"[\s\S]*?colors\.textSecondary/,
    );
    expect(PLANNER_SRC).toMatch(/tone === "amber"[\s\S]*?Accent\.warning/);
    // `: Accent.destructive` is the "red" fallback after the two
    // ternary branches.
    expect(PLANNER_SRC).toMatch(/Accent\.destructive/);
  });

  it("promotes the calorie goal into the day header (F-63a — was 'Day total · X/Y kcal' wrap row)", () => {
    // F-63a (2026-04-22, AERuv07KI + AJ8Fk6ud): the "Day total" label
    // + wrap row was removed — the goal-aware kcal is now a single
    // tonally-coloured string in the day header instead of a separate
    // `Day total · N / Y kcal · P/C/F · …` line. Ensure the new
    // render path is in place and the shared helper still drives the
    // cell/tone data via `goalLine.cells[0]` (calories cell).
    expect(PLANNER_SRC).toMatch(/goalLine\.cells\[0\]/);
    expect(PLANNER_SRC).toMatch(
      /\$\{Math\.round\(goalLine\.totals\.calories\)[\s\S]*?planTargets!\.calories/,
    );
    // The old literal "Day total" label must not regress.
    expect(PLANNER_SRC).not.toMatch(/>\s*Day total\s*</);
  });
});

describe("mobile planner — shared helper behaves as expected when called directly", () => {
  it("classifies a 1373 vs 1411 kcal day as neutral (within ±10%)", () => {
    expect(classifyDayDelta(1373, 1411)).toBe("neutral");
  });

  it("returns hasTargets=false when any goal is missing (new account)", () => {
    const line = buildDayTotalVsGoalLine(
      [
        {
          name: "Breakfast",
          recipeTitle: "Oats",
          calories: 400,
          protein: 30,
          carbs: 50,
          fat: 10,
        },
      ],
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    expect(line.hasTargets).toBe(false);
  });

  it("scales totals by portionMultiplier", () => {
    const line = buildDayTotalVsGoalLine(
      [
        {
          name: "Dinner",
          recipeTitle: "Salmon bowl",
          calories: 500,
          protein: 40,
          carbs: 30,
          fat: 20,
          portionMultiplier: 1.5,
        },
      ],
      { calories: 2000, protein: 150, carbs: 200, fat: 65 },
    );
    expect(line.totals.calories).toBe(750);
    expect(line.totals.protein).toBe(60);
  });

  it("formats the calorie cell as '1,373 / 1,411 kcal'", () => {
    const line = buildDayTotalVsGoalLine(
      [
        {
          name: "Breakfast",
          recipeTitle: "Oats",
          calories: 1373,
          protein: 103,
          carbs: 142,
          fat: 45,
        },
      ],
      { calories: 1411, protein: 120, carbs: 180, fat: 55 },
    );
    const cal = line.cells.find((c) => c.key === "calories")!;
    expect(formatDayTotalCell(cal)).toBe("1,373 / 1,411 kcal");
  });
});
