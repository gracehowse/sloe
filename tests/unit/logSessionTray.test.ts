/**
 * logSessionTray (shared) — pure tray math for the ENG-1643 session tray.
 * Spec: `docs/specs/2026-07-21-log-session-tray.md` §11.1.
 *
 * Covers:
 *  - `sessionTrayTotals` sums per-item committed macros with the SAME rounding
 *    the single-item commit path uses (kcal → int, macros → 1dp), so a 1-item
 *    tray totals to exactly that item's logged row;
 *  - NaN / negative inputs clamp to 0 (a malformed item never poisons the total);
 *  - `trayIsFullyVerified` (all-verified vs any-unverified vs empty);
 *  - `trayIsMultiSlot`;
 *  - `resolveUsualMealName` (empty / 1-item / single-slot / multi-slot).
 */
import { describe, expect, it } from "vitest";
import {
  resolveUsualMealName,
  sessionTrayTotals,
  trayIsFullyVerified,
  trayIsMultiSlot,
  type LogSessionTrayItem,
} from "@/lib/nutrition/logSessionTray";

function item(partial: Partial<LogSessionTrayItem> = {}): LogSessionTrayItem {
  return {
    mealId: "m1",
    title: "Chicken breast",
    kcal: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    slot: "Dinner",
    ...partial,
  };
}

describe("sessionTrayTotals", () => {
  it("empty tray totals to all-zero with count 0", () => {
    expect(sessionTrayTotals([])).toEqual({
      count: 0,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("1-item tray totals to exactly that item's committed macros (single-item parity)", () => {
    const only = item({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 });
    expect(sessionTrayTotals([only])).toEqual({
      count: 1,
      kcal: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
    });
  });

  it("sums multiple items and rounds kcal to int + macros to 1dp", () => {
    const totals = sessionTrayTotals([
      item({ mealId: "a", kcal: 165, protein: 31, carbs: 0, fat: 3.6 }),
      item({ mealId: "b", kcal: 95.4, protein: 0.5, carbs: 25.25, fat: 0.3 }),
      item({ mealId: "c", kcal: 210.5, protein: 4.44, carbs: 12.31, fat: 8.99 }),
    ]);
    expect(totals.count).toBe(3);
    // 165 + 95.4 + 210.5 = 470.9 → round → 471
    expect(totals.kcal).toBe(471);
    // 31 + 0.5 + 4.44 = 35.94 → 35.9
    expect(totals.protein).toBe(35.9);
    // 0 + 25.25 + 12.31 = 37.56 → 37.6
    expect(totals.carbs).toBe(37.6);
    // 3.6 + 0.3 + 8.99 = 12.89 → 12.9
    expect(totals.fat).toBe(12.9);
  });

  it("clamps NaN and negative values to 0 (never poisons the total)", () => {
    const totals = sessionTrayTotals([
      item({ mealId: "a", kcal: 200, protein: 10, carbs: 20, fat: 5 }),
      item({ mealId: "b", kcal: Number.NaN, protein: -8, carbs: Number.NaN, fat: -3 }),
    ]);
    expect(totals).toEqual({
      count: 2,
      kcal: 200,
      protein: 10,
      carbs: 20,
      fat: 5,
    });
  });
});

describe("trayIsFullyVerified", () => {
  it("false for an empty tray (nothing to trust)", () => {
    expect(trayIsFullyVerified([])).toBe(false);
  });

  it("true only when every item is verified", () => {
    expect(
      trayIsFullyVerified([
        item({ mealId: "a", kcalIsVerified: true }),
        item({ mealId: "b", kcalIsVerified: true }),
      ]),
    ).toBe(true);
  });

  it("false when any item is unverified or missing the bit", () => {
    expect(
      trayIsFullyVerified([
        item({ mealId: "a", kcalIsVerified: true }),
        item({ mealId: "b", kcalIsVerified: false }),
      ]),
    ).toBe(false);
    expect(
      trayIsFullyVerified([
        item({ mealId: "a", kcalIsVerified: true }),
        item({ mealId: "b" }), // undefined → unverified
      ]),
    ).toBe(false);
  });
});

describe("trayIsMultiSlot", () => {
  it("false for 0 or 1 items", () => {
    expect(trayIsMultiSlot([])).toBe(false);
    expect(trayIsMultiSlot([item()])).toBe(false);
  });

  it("false when every item shares a slot", () => {
    expect(
      trayIsMultiSlot([
        item({ mealId: "a", slot: "Dinner" }),
        item({ mealId: "b", slot: "Dinner" }),
      ]),
    ).toBe(false);
  });

  it("true when items span more than one slot", () => {
    expect(
      trayIsMultiSlot([
        item({ mealId: "a", slot: "Lunch" }),
        item({ mealId: "b", slot: "Dinner" }),
      ]),
    ).toBe(true);
  });
});

describe("resolveUsualMealName", () => {
  it("empty tray → empty string", () => {
    expect(resolveUsualMealName([])).toBe("");
  });

  it("single-slot tray → '{n}-item {slot}' (lower-cased)", () => {
    expect(
      resolveUsualMealName([
        item({ mealId: "a", slot: "Dinner" }),
        item({ mealId: "b", slot: "Dinner" }),
        item({ mealId: "c", slot: "Dinner" }),
      ]),
    ).toBe("3-item dinner");
  });

  it("single item → '1-item {slot}'", () => {
    expect(resolveUsualMealName([item({ slot: "Breakfast" })])).toBe(
      "1-item breakfast",
    );
  });

  it("multi-slot tray → '{n}-item meal'", () => {
    expect(
      resolveUsualMealName([
        item({ mealId: "a", slot: "Lunch" }),
        item({ mealId: "b", slot: "Dinner" }),
      ]),
    ).toBe("2-item meal");
  });

  it("blank slot falls back to '{n}-item meal'", () => {
    expect(
      resolveUsualMealName([
        item({ mealId: "a", slot: "" }),
        item({ mealId: "b", slot: "" }),
      ]),
    ).toBe("2-item meal");
  });
});
