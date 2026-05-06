import { describe, expect, it } from "vitest";
import {
  KCAL_PER_KG_FAT,
  weekDeficitToKg,
} from "@/lib/nutrition/maintenanceChain";

/**
 * 2026-05-05 (audit T14) — single 7700 kcal/kg conversion path used by
 * both Today's Activity Bonus card (mobile + web) and the Why-this-
 * number explainer. Was previously two paths: 3500/lb * 0.4536/kg in
 * the Activity Bonus card, 7700 elsewhere — ~0.2% drift across surfaces
 * for the same weekly deficit input.
 */
describe("weekDeficitToKg", () => {
  it("is 1 kg per KCAL_PER_KG_FAT (7700)", () => {
    expect(weekDeficitToKg(KCAL_PER_KG_FAT)).toBe(1);
    expect(weekDeficitToKg(7700)).toBe(1);
  });

  it("is 0 for zero input", () => {
    expect(weekDeficitToKg(0)).toBe(0);
  });

  it("uses absolute value (negative deficit = surplus magnitude)", () => {
    expect(weekDeficitToKg(-3850)).toBeCloseTo(0.5, 6);
    expect(weekDeficitToKg(3850)).toBeCloseTo(0.5, 6);
  });

  it("returns 0 for non-finite input (NaN, Infinity) — no NaN leaks", () => {
    expect(weekDeficitToKg(Number.NaN)).toBe(0);
    expect(weekDeficitToKg(Number.POSITIVE_INFINITY)).toBe(0);
    expect(weekDeficitToKg(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("matches the canonical formula `abs(weekDeficit) / 7700`", () => {
    // Spot-check a realistic week deficit: 3500 kcal across 7 days.
    // Old path: 3500 / 3500 * 0.4536 = 0.4536 kg
    // New path: 3500 / 7700 = 0.4545... kg
    // Our test is the new path (single source of truth).
    expect(weekDeficitToKg(3500)).toBeCloseTo(3500 / 7700, 6);
    expect(weekDeficitToKg(7000)).toBeCloseTo(7000 / 7700, 6);
  });
});
