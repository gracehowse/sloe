/**
 * ENG-1361 — behavioral pin for the "log a meal → macros update" contract.
 *
 * This is the exact math the mobile Today tracker's `totals` useMemo (and
 * the equivalent web tracker aggregation) delegates to: sum a day's logged
 * meals into the five running totals (calories/protein/carbs/fat/fiber)
 * the macro rings, macro tiles, and remaining-macros math all read from.
 * If this contract breaks, logging a meal silently stops moving the
 * on-screen numbers — the single highest-trust-risk regression on the
 * Today tab (see `project_nutrition_trust_label_cluster_critical`).
 */
import { describe, expect, it } from "vitest";
import { computeDayMacroTotals, type DayMacroTotalsMeal } from "@/lib/nutrition/microNutrientDisplay";

function meal(overrides: Partial<DayMacroTotalsMeal> = {}): DayMacroTotalsMeal {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ...overrides,
  };
}

describe("computeDayMacroTotals — log a meal, macros update", () => {
  it("returns all-zero totals for an empty day", () => {
    const totals = computeDayMacroTotals([]);
    expect(totals).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });

  it("logging a single meal moves every macro total by exactly that meal's values", () => {
    const totals = computeDayMacroTotals([
      meal({ calories: 420, protein: 31, carbs: 44, fat: 12, fiberG: 6 }),
    ]);
    expect(totals).toEqual({ calories: 420, protein: 31, carbs: 44, fat: 12, fiber: 6 });
  });

  it("logging a second meal adds to the running totals rather than replacing them", () => {
    const day = [
      meal({ calories: 420, protein: 31, carbs: 44, fat: 12, fiberG: 6 }),
      meal({ calories: 650, protein: 40, carbs: 70, fat: 22, fiberG: 8 }),
    ];
    const totals = computeDayMacroTotals(day);
    expect(totals.calories).toBe(1070);
    expect(totals.protein).toBe(71);
    expect(totals.carbs).toBe(114);
    expect(totals.fat).toBe(34);
    expect(totals.fiber).toBe(14);
  });

  it("editing a meal's macros (portion change) changes the day total by the delta, not the whole meal", () => {
    const before = computeDayMacroTotals([meal({ calories: 500, protein: 30, carbs: 50, fat: 15 })]);
    // Doubling a 500 kcal meal's portion should move the day total to 1000,
    // not stack a second independent meal's worth on top.
    const after = computeDayMacroTotals([meal({ calories: 1000, protein: 60, carbs: 100, fat: 30 })]);
    expect(after.calories - before.calories).toBe(500);
    expect(after.protein - before.protein).toBe(30);
  });

  it("deleting a meal (day now empty) drops totals back to zero", () => {
    const withMeal = computeDayMacroTotals([meal({ calories: 300, protein: 20, carbs: 30, fat: 10 })]);
    expect(withMeal.calories).toBe(300);
    const afterDelete = computeDayMacroTotals([]);
    expect(afterDelete).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });

  it("clamps a malformed negative macro value to zero instead of pulling the day total down", () => {
    const totals = computeDayMacroTotals([
      meal({ calories: 400, protein: -10, carbs: 40, fat: 10 }),
    ]);
    // A negative protein value (e.g. a bad edit) contributes 0, not -10.
    expect(totals.protein).toBe(0);
    expect(totals.calories).toBe(400);
  });

  it("falls back to nutrition_micros.fiberG when a meal has no fiberG column (Health-imported meal)", () => {
    const totals = computeDayMacroTotals([
      meal({ calories: 200, protein: 5, carbs: 20, fat: 5, fiberG: null, micros: { fiberG: 4 } }),
    ]);
    expect(totals.fiber).toBe(4);
  });

  it("rounds fractional totals to whole units for display", () => {
    const totals = computeDayMacroTotals([
      meal({ calories: 100.4, protein: 10.6, carbs: 10.5, fat: 5.49 }),
    ]);
    expect(totals.calories).toBe(100);
    expect(totals.protein).toBe(11);
    expect(totals.carbs).toBe(11);
    expect(totals.fat).toBe(5);
  });
});
