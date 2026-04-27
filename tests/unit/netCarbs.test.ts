/**
 * P2-26 (2026-04-25) — pin the net-carbs math + label switching so
 * surface implementations on web + mobile can't drift.
 */
import { describe, it, expect } from "vitest";
import {
  carbsLabel,
  carbsShortLabel,
  netCarbsForRow,
} from "../../src/lib/nutrition/netCarbs";

describe("netCarbsForRow", () => {
  it("returns total carbs unchanged when lens is disabled", () => {
    expect(netCarbsForRow(50, 6, false)).toBe(50);
    expect(netCarbsForRow(50, null, false)).toBe(50);
    expect(netCarbsForRow(50, undefined, false)).toBe(50);
  });

  it("subtracts fibre from carbs when lens is enabled", () => {
    expect(netCarbsForRow(50, 6, true)).toBe(44);
    expect(netCarbsForRow(20, 4, true)).toBe(16);
    expect(netCarbsForRow(8.5, 2.5, true)).toBe(6);
  });

  it("floors at 0 when fibre exceeds carbs (rounding / parsing edge)", () => {
    expect(netCarbsForRow(3, 5, true)).toBe(0);
    expect(netCarbsForRow(0, 1, true)).toBe(0);
  });

  it("returns total carbs when fibre is null / undefined / non-finite (refuse to guess)", () => {
    expect(netCarbsForRow(50, null, true)).toBe(50);
    expect(netCarbsForRow(50, undefined, true)).toBe(50);
    expect(netCarbsForRow(50, Number.NaN, true)).toBe(50);
    expect(netCarbsForRow(50, 0, true)).toBe(50);
  });
});

describe("carbsLabel", () => {
  it("returns 'Carbs' when the lens is off regardless of fibre", () => {
    expect(carbsLabel(6, false)).toBe("Carbs");
    expect(carbsLabel(null, false)).toBe("Carbs");
  });

  it("returns 'Net carbs' when the lens is on AND fibre is known", () => {
    expect(carbsLabel(6, true)).toBe("Net carbs");
    expect(carbsLabel(0.5, true)).toBe("Net carbs");
  });

  it("falls back to 'Carbs' when the lens is on but fibre is missing — no misleading label", () => {
    // A surface that says "Net carbs: 50g" with no fibre data is
    // promising precision the row can't deliver. Same shape as the
    // Pillar 2 honesty principle that drives macroSplitConfidence.
    expect(carbsLabel(null, true)).toBe("Carbs");
    expect(carbsLabel(undefined, true)).toBe("Carbs");
    expect(carbsLabel(0, true)).toBe("Carbs");
    expect(carbsLabel(Number.NaN, true)).toBe("Carbs");
  });
});

describe("carbsShortLabel", () => {
  it("returns NET C / C in lockstep with carbsLabel", () => {
    expect(carbsShortLabel(6, true)).toBe("NET C");
    expect(carbsShortLabel(6, false)).toBe("C");
    expect(carbsShortLabel(null, true)).toBe("C");
    expect(carbsShortLabel(null, false)).toBe("C");
  });
});
