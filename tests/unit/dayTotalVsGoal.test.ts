import { describe, expect, it } from "vitest";
import {
  buildDayTotalVsGoalLine,
  classifyDayDelta,
  DAY_TOTAL_AMBER_BAND,
  DAY_TOTAL_NEUTRAL_BAND,
  formatDayTotalCell,
  formatDayTotalVsGoalLine,
} from "../../src/lib/planning/dayTotalVsGoal.ts";
import type { DayPlanMeal } from "../../src/types/recipe.ts";

/**
 * Build-12 H-5 — `AH8csBqtZsBJJr0uHgXyEcE`: "Plan doesn't tell me how
 * close it is to my macro targets." The helper is the single source of
 * truth for the "Day total · X / Y kcal · P / C / F" summary line on
 * web and mobile. These tests pin: symmetric tolerance bands, scaling
 * respect for `portionMultiplier`, empty-day behaviour, goal=0 safety,
 * formatting, and `hasTargets` gating.
 */

function meal(partial: Partial<DayPlanMeal>): DayPlanMeal {
  return {
    name: partial.name ?? "Breakfast",
    recipeTitle: partial.recipeTitle ?? "Oats",
    calories: partial.calories ?? 0,
    protein: partial.protein ?? 0,
    carbs: partial.carbs ?? 0,
    fat: partial.fat ?? 0,
    portionMultiplier: partial.portionMultiplier,
    isPlaceholder: partial.isPlaceholder,
  };
}

describe("classifyDayDelta — symmetric tolerance bands", () => {
  it("returns neutral within ±10% on both sides", () => {
    // goal = 1000; 900 = -10%, 1000 = 0%, 1100 = +10% — all neutral
    expect(classifyDayDelta(900, 1000)).toBe("neutral");
    expect(classifyDayDelta(1000, 1000)).toBe("neutral");
    expect(classifyDayDelta(1100, 1000)).toBe("neutral");
  });

  it("returns amber between 10% and 20% on both sides", () => {
    // goal = 1000; 850 = -15% over band → amber, 1150 = +15% → amber
    expect(classifyDayDelta(850, 1000)).toBe("amber");
    expect(classifyDayDelta(1150, 1000)).toBe("amber");
    // Boundary: exactly 20% → amber (inclusive)
    expect(classifyDayDelta(800, 1000)).toBe("amber");
    expect(classifyDayDelta(1200, 1000)).toBe("amber");
  });

  it("returns red outside ±20% on both sides", () => {
    // goal = 1000; 750 = -25% → red, 1250 = +25% → red
    expect(classifyDayDelta(750, 1000)).toBe("red");
    expect(classifyDayDelta(1250, 1000)).toBe("red");
    // Way outside
    expect(classifyDayDelta(0, 1000)).toBe("red");
    expect(classifyDayDelta(5000, 1000)).toBe("red");
  });

  it("is direction-agnostic — over and under trigger same tone at same |delta|", () => {
    // The product requirement: exceeding goal is not 'bad' for
    // gain-goal users. Over and under both classify the same.
    const under = classifyDayDelta(850, 1000); // -15%
    const over = classifyDayDelta(1150, 1000); // +15%
    expect(under).toBe(over);
  });

  it("never divides by zero when goal is 0, negative, or non-finite", () => {
    expect(classifyDayDelta(500, 0)).toBe("neutral");
    expect(classifyDayDelta(500, -100)).toBe("neutral");
    expect(classifyDayDelta(500, NaN)).toBe("neutral");
    expect(classifyDayDelta(500, Infinity)).toBe("neutral");
  });

  it("handles non-finite actual gracefully", () => {
    expect(classifyDayDelta(NaN, 1000)).toBe("neutral");
    expect(classifyDayDelta(Infinity, 1000)).toBe("neutral");
  });

  it("band constants match the spec (10% neutral, 20% amber)", () => {
    expect(DAY_TOTAL_NEUTRAL_BAND).toBe(0.1);
    expect(DAY_TOTAL_AMBER_BAND).toBe(0.2);
  });
});

describe("buildDayTotalVsGoalLine — totals", () => {
  const goals = { calories: 2000, protein: 150, carbs: 200, fat: 65 };

  it("sums un-scaled meals correctly", () => {
    const meals = [
      meal({ calories: 400, protein: 30, carbs: 50, fat: 10 }),
      meal({ calories: 600, protein: 40, carbs: 70, fat: 15 }),
    ];
    const line = buildDayTotalVsGoalLine(meals, goals);
    expect(line.totals).toEqual({ calories: 1000, protein: 70, carbs: 120, fat: 25 });
  });

  it("respects 0.5x portionMultiplier in totals", () => {
    const meals = [
      meal({ calories: 400, protein: 30, carbs: 50, fat: 10, portionMultiplier: 0.5 }),
    ];
    const line = buildDayTotalVsGoalLine(meals, goals);
    // 400 × 0.5 = 200; 30 × 0.5 = 15; 50 × 0.5 = 25; 10 × 0.5 = 5
    expect(line.totals).toEqual({ calories: 200, protein: 15, carbs: 25, fat: 5 });
  });

  it("respects 1.5x portionMultiplier in totals", () => {
    const meals = [
      meal({ calories: 400, protein: 30, carbs: 50, fat: 10, portionMultiplier: 1.5 }),
    ];
    const line = buildDayTotalVsGoalLine(meals, goals);
    expect(line.totals).toEqual({ calories: 600, protein: 45, carbs: 75, fat: 15 });
  });

  it("respects 2x portionMultiplier", () => {
    const meals = [
      meal({ calories: 500, protein: 40, carbs: 20, fat: 20, portionMultiplier: 2 }),
    ];
    const line = buildDayTotalVsGoalLine(meals, goals);
    expect(line.totals).toEqual({ calories: 1000, protein: 80, carbs: 40, fat: 40 });
  });

  it("skips placeholder meals in totals", () => {
    const meals = [
      meal({ calories: 400, protein: 30, carbs: 50, fat: 10 }),
      meal({ calories: 999, protein: 99, carbs: 99, fat: 99, isPlaceholder: true }),
    ];
    const line = buildDayTotalVsGoalLine(meals, goals);
    expect(line.totals).toEqual({ calories: 400, protein: 30, carbs: 50, fat: 10 });
  });

  it("mixes scaled and unscaled meals in one day", () => {
    const meals = [
      meal({ calories: 400, protein: 30, carbs: 50, fat: 10 }),
      meal({ calories: 500, protein: 40, carbs: 20, fat: 20, portionMultiplier: 1.5 }),
      meal({ calories: 300, protein: 25, carbs: 30, fat: 10, portionMultiplier: 0.5 }),
    ];
    const line = buildDayTotalVsGoalLine(meals, goals);
    // 400 + 750 + 150 = 1300 (scaledMacro rounds per-row)
    expect(line.totals.calories).toBe(400 + 750 + 150);
    expect(line.totals.protein).toBe(30 + 60 + 13);
    expect(line.totals.carbs).toBe(50 + 30 + 15);
    expect(line.totals.fat).toBe(10 + 30 + 5);
  });

  it("returns zeroed totals for a 0-meal day (no divide-by-zero, no crash)", () => {
    const line = buildDayTotalVsGoalLine([], goals);
    expect(line.totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(line.hasTargets).toBe(true);
    // 0 vs 2000 → -100% → red; pin the tone so UI visibly reads "far from goal"
    expect(line.cells[0]!.tone).toBe("red");
    expect(line.cells[0]!.actual).toBe(0);
    expect(line.cells[0]!.goal).toBe(2000);
  });
});

describe("buildDayTotalVsGoalLine — hasTargets gating", () => {
  const meals = [meal({ calories: 400, protein: 30, carbs: 50, fat: 10 })];

  it("returns hasTargets=true when all four goals are positive", () => {
    const line = buildDayTotalVsGoalLine(meals, { calories: 2000, protein: 150, carbs: 200, fat: 65 });
    expect(line.hasTargets).toBe(true);
  });

  it("returns hasTargets=false when calories goal is 0 (new account)", () => {
    const line = buildDayTotalVsGoalLine(meals, { calories: 0, protein: 150, carbs: 200, fat: 65 });
    expect(line.hasTargets).toBe(false);
  });

  it("returns hasTargets=false when protein goal is 0", () => {
    const line = buildDayTotalVsGoalLine(meals, { calories: 2000, protein: 0, carbs: 200, fat: 65 });
    expect(line.hasTargets).toBe(false);
  });

  it("returns hasTargets=false when carbs goal is 0", () => {
    const line = buildDayTotalVsGoalLine(meals, { calories: 2000, protein: 150, carbs: 0, fat: 65 });
    expect(line.hasTargets).toBe(false);
  });

  it("returns hasTargets=false when fat goal is 0", () => {
    const line = buildDayTotalVsGoalLine(meals, { calories: 2000, protein: 150, carbs: 200, fat: 0 });
    expect(line.hasTargets).toBe(false);
  });

  it("returns hasTargets=false when any goal is negative or non-finite", () => {
    expect(buildDayTotalVsGoalLine(meals, { calories: -1, protein: 150, carbs: 200, fat: 65 }).hasTargets).toBe(false);
    expect(buildDayTotalVsGoalLine(meals, { calories: NaN, protein: 150, carbs: 200, fat: 65 }).hasTargets).toBe(false);
    expect(buildDayTotalVsGoalLine(meals, { calories: Infinity, protein: 150, carbs: 200, fat: 65 }).hasTargets).toBe(false);
  });

  it("zeroes the displayed goal values when hasTargets is false (still safe to render if caller ignores guard)", () => {
    const line = buildDayTotalVsGoalLine(meals, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    expect(line.hasTargets).toBe(false);
    for (const cell of line.cells) {
      expect(cell.goal).toBe(0);
      expect(cell.tone).toBe("neutral"); // degrades to neutral so nothing shouts red behind the guard
    }
  });
});

describe("buildDayTotalVsGoalLine — cell classification in context", () => {
  it("pins the spec example: 1373 kcal vs 1411 goal → neutral", () => {
    // From the task spec screenshot / copy. 1373 vs 1411 is ~2.7%
    // under — well inside the 10% neutral band.
    const meals = [
      meal({ calories: 336, protein: 9, carbs: 26, fat: 11 }),
      meal({ calories: 500, protein: 40, carbs: 50, fat: 18 }),
      meal({ calories: 300, protein: 30, carbs: 30, fat: 10 }),
      meal({ calories: 237, protein: 24, carbs: 36, fat: 6 }),
    ];
    const line = buildDayTotalVsGoalLine(meals, {
      calories: 1411,
      protein: 120,
      carbs: 180,
      fat: 55,
    });
    expect(line.totals.calories).toBe(1373);
    const cal = line.cells.find((c) => c.key === "calories")!;
    expect(cal.tone).toBe("neutral");
    expect(cal.actual).toBe(1373);
    expect(cal.goal).toBe(1411);
  });

  it("classifies each macro independently — cal neutral, protein red", () => {
    const meals = [meal({ calories: 2000, protein: 20, carbs: 200, fat: 65 })];
    const line = buildDayTotalVsGoalLine(meals, {
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 65,
    });
    expect(line.cells.find((c) => c.key === "calories")!.tone).toBe("neutral");
    expect(line.cells.find((c) => c.key === "protein")!.tone).toBe("red"); // 20 vs 150 = -87%
    expect(line.cells.find((c) => c.key === "carbs")!.tone).toBe("neutral");
    expect(line.cells.find((c) => c.key === "fat")!.tone).toBe("neutral");
  });

  it("emits cells in a stable order: calories, protein, carbs, fat", () => {
    const line = buildDayTotalVsGoalLine(
      [meal({ calories: 100, protein: 10, carbs: 10, fat: 5 })],
      { calories: 2000, protein: 150, carbs: 200, fat: 65 },
    );
    expect(line.cells.map((c) => c.key)).toEqual(["calories", "protein", "carbs", "fat"]);
  });
});

describe("formatDayTotalCell + formatDayTotalVsGoalLine", () => {
  it("formats the calorie cell as '1,373 / 1,411 kcal'", () => {
    const line = buildDayTotalVsGoalLine(
      [
        meal({ calories: 1373, protein: 103, carbs: 142, fat: 45 }),
      ],
      { calories: 1411, protein: 120, carbs: 180, fat: 55 },
    );
    const cal = line.cells.find((c) => c.key === "calories")!;
    expect(formatDayTotalCell(cal)).toBe("1,373 / 1,411 kcal");
  });

  it("formats macro cells as 'P 103 / 120g'", () => {
    const line = buildDayTotalVsGoalLine(
      [meal({ calories: 1373, protein: 103, carbs: 142, fat: 45 })],
      { calories: 1411, protein: 120, carbs: 180, fat: 55 },
    );
    expect(formatDayTotalCell(line.cells[1]!)).toBe("P 103 / 120g");
    expect(formatDayTotalCell(line.cells[2]!)).toBe("C 142 / 180g");
    expect(formatDayTotalCell(line.cells[3]!)).toBe("F 45 / 55g");
  });

  it("renders the full line in the exact spec shape", () => {
    const line = buildDayTotalVsGoalLine(
      [meal({ calories: 1373, protein: 103, carbs: 142, fat: 45 })],
      { calories: 1411, protein: 120, carbs: 180, fat: 55 },
    );
    expect(formatDayTotalVsGoalLine(line)).toBe(
      "Day total · 1,373 / 1,411 kcal · P 103 / 120g · C 142 / 180g · F 45 / 55g",
    );
  });

  it("rounds fractional totals to whole numbers for display", () => {
    // `dayPlanTotalsFromMeals` already rounds per-meal via `scaledMacro`,
    // but the formatter should also defensively round in case a caller
    // ever passes raw totals.
    const line = buildDayTotalVsGoalLine(
      [meal({ calories: 333, protein: 33, carbs: 33, fat: 11, portionMultiplier: 1.5 })],
      { calories: 1000, protein: 100, carbs: 100, fat: 50 },
    );
    // 333 × 1.5 = 499.5 → rounds to 500 inside scaledMacro
    const cal = line.cells[0]!;
    expect(formatDayTotalCell(cal)).toBe("500 / 1,000 kcal");
  });
});
