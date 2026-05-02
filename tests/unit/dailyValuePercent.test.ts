/**
 * dailyValuePercent — pin %DV math + null semantics for the Today Micros
 * widget.
 *
 * The widget renders 4 headline tiles (Fiber / Iron / Vit D / Sodium) with
 * progress bars derived from these helpers. If the math drifts, the
 * colour ramps and "X / Y" labels misrepresent the user's day. This file
 * pins the canonical FDA 2020 DV references + the limit-vs-target
 * semantic for sodium.
 */
import { describe, expect, it } from "vitest";
import {
  dailyValuePercent,
  isLimitNutrient,
  DAILY_VALUES,
} from "@/../src/lib/nutrition/dailyValues";

describe("dailyValuePercent", () => {
  it("computes fiber %DV against the FDA 28g reference", () => {
    // 14g / 28g = 50%
    expect(dailyValuePercent("fiberG", 14)).toBe(50);
    expect(dailyValuePercent("fiberG", 28)).toBe(100);
    expect(dailyValuePercent("fiberG", 0)).toBe(0);
  });

  it("computes iron %DV against the FDA 18mg reference", () => {
    expect(dailyValuePercent("ironMg", 9)).toBe(50);
    expect(dailyValuePercent("ironMg", 18)).toBe(100);
  });

  it("computes vitamin D %DV against the FDA 20mcg reference", () => {
    expect(dailyValuePercent("vitaminDMcg", 10)).toBe(50);
    expect(dailyValuePercent("vitaminDMcg", 20)).toBe(100);
  });

  it("computes sodium %DV against the 2300mg limit", () => {
    expect(dailyValuePercent("sodiumMg", 1150)).toBe(50);
    expect(dailyValuePercent("sodiumMg", 2300)).toBe(100);
    // Sodium goes over the limit — math still works, callers handle ramp.
    expect(dailyValuePercent("sodiumMg", 2760)).toBe(120);
  });

  it("rounds %DV to the nearest integer", () => {
    // 13g / 28g = 46.428...% → 46
    expect(dailyValuePercent("fiberG", 13)).toBe(46);
    // 17mg / 18mg = 94.44...% → 94
    expect(dailyValuePercent("ironMg", 17)).toBe(94);
  });

  it("returns null for nutrients without a DV", () => {
    // PR #47 expanded the DV table to 34 nutrients; riboflavin now
    // has a DV (1.3mg). Stick to nutrients that genuinely have no
    // FDA DV — caffeine and total sugar (only ADDED sugar has a DV).
    expect(dailyValuePercent("caffeineMg", 200)).toBeNull();
    expect(dailyValuePercent("sugarG", 50)).toBeNull();
  });

  it("returns null for empty / non-string nutrient keys", () => {
    expect(dailyValuePercent("", 10)).toBeNull();
    // @ts-expect-error — defensive: caller passed non-string
    expect(dailyValuePercent(undefined, 10)).toBeNull();
  });

  it("returns null for non-finite or negative amounts", () => {
    expect(dailyValuePercent("fiberG", NaN)).toBeNull();
    expect(dailyValuePercent("fiberG", Infinity)).toBeNull();
    expect(dailyValuePercent("fiberG", -1)).toBeNull();
  });

  it("treats sodium as a limit nutrient and others as targets", () => {
    expect(isLimitNutrient("sodiumMg")).toBe(true);
    expect(isLimitNutrient("fiberG")).toBe(false);
    expect(isLimitNutrient("ironMg")).toBe(false);
    expect(isLimitNutrient("vitaminDMcg")).toBe(false);
  });

  it("exposes a frozen DV table that matches the FDA 2020 reference set", () => {
    // Snapshot the canonical values. If a value changes, that is a
    // labelling decision and should be deliberate — not a silent drift.
    expect(DAILY_VALUES.fiberG).toBe(28);
    expect(DAILY_VALUES.ironMg).toBe(18);
    expect(DAILY_VALUES.vitaminDMcg).toBe(20);
    expect(DAILY_VALUES.sodiumMg).toBe(2300);
    expect(DAILY_VALUES.magnesiumMg).toBe(420);
    expect(DAILY_VALUES.potassiumMg).toBe(4700);
    expect(DAILY_VALUES.calciumMg).toBe(1300);
    expect(DAILY_VALUES.vitaminCMg).toBe(90);
  });

  it("does not mutate the DV table", () => {
    expect(() => {
      // @ts-expect-error — DV table is intentionally frozen.
      DAILY_VALUES.fiberG = 999;
    }).toThrow();
  });

  it("computes 0% for zero amount across all DV-keyed nutrients", () => {
    for (const key of Object.keys(DAILY_VALUES)) {
      expect(dailyValuePercent(key, 0)).toBe(0);
    }
  });
});
