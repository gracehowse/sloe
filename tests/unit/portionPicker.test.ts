import { describe, expect, it } from "vitest";

import {
  buildPickerOptions,
  formatPortion,
  parseServingLabel,
  roundAmount,
  stateToGrams,
  stepperStep,
  switchUnit,
  unitLabel,
  type PortionUnit,
} from "../../src/lib/nutrition/portionPicker";

/**
 * Pins the portion-picker state model adopted 2026-05-13. The legacy
 * `logBasis: per100g | perServing` toggle is gone; replaced by a single
 * `{ amount, unit }` pair where the unit IS the user's mental model.
 *
 * Most important contracts:
 *  - Unit switches preserve gram weight (so "3 meatballs" → "66 g" is
 *    reversible without surprise).
 *  - parseServingLabel rejects non-count labels ("100 g", "1 oz") so
 *    they don't shadow the dedicated gram/ounce units.
 *  - rememberedGrams resolves back to the count unit when close.
 */

const meatballProduct = {
  servingSizeG: 87,
  servingOptions: [
    { label: "1 meatball (~22 g)", grams: 22 },
    { label: "4 meatballs", grams: 87 },
  ],
};

const gramOnlyProduct = {
  servingSizeG: null,
  servingOptions: [{ label: "100 g", grams: 100 }],
};

describe("parseServingLabel", () => {
  it("parses '1 meatball (~22 g)' as count=1 name='meatball'", () => {
    expect(parseServingLabel("1 meatball (~22 g)")).toEqual({ count: 1, name: "meatball" });
  });

  it("parses '4 meatballs' as count=4 name='meatballs'", () => {
    expect(parseServingLabel("4 meatballs")).toEqual({ count: 4, name: "meatballs" });
  });

  it("rejects pure gram labels", () => {
    expect(parseServingLabel("100 g")).toBeNull();
    expect(parseServingLabel("50 grams")).toBeNull();
  });

  it("rejects ounce labels", () => {
    expect(parseServingLabel("1 oz")).toBeNull();
    expect(parseServingLabel("2 ounces")).toBeNull();
  });

  it("rejects 'serving' alias (handled separately)", () => {
    expect(parseServingLabel("1 serving")).toBeNull();
    expect(parseServingLabel("2 servings")).toBeNull();
  });
});

describe("buildPickerOptions", () => {
  it("derives a 'meatball' count unit from the (~22 g) entry", () => {
    const opts = buildPickerOptions(meatballProduct);
    const meatball = opts.units.find(
      (u): u is Extract<PortionUnit, { kind: "count" }> => u.kind === "count" && u.singular === "meatball",
    );
    expect(meatball).toBeTruthy();
    expect(meatball!.gramsPerUnit).toBe(22);
    expect(meatball!.plural).toBe("meatballs");
  });

  it("includes serving / gram / ounce units when applicable", () => {
    const opts = buildPickerOptions(meatballProduct);
    expect(opts.units.some((u) => u.kind === "serving")).toBe(true);
    expect(opts.units.some((u) => u.kind === "gram")).toBe(true);
    expect(opts.units.some((u) => u.kind === "ounce")).toBe(true);
  });

  it("omits the serving unit when servingSizeG is missing", () => {
    const opts = buildPickerOptions(gramOnlyProduct);
    expect(opts.units.some((u) => u.kind === "serving")).toBe(false);
  });

  it("defaults to '1 <count unit>' when a count unit exists", () => {
    const opts = buildPickerOptions(meatballProduct);
    expect(opts.initial.amount).toBe(1);
    expect(opts.initial.unit.kind).toBe("count");
  });

  it("defaults to '1 serving' when only serving is available", () => {
    const opts = buildPickerOptions({ servingSizeG: 250, servingOptions: [] });
    expect(opts.initial.amount).toBe(1);
    expect(opts.initial.unit.kind).toBe("serving");
  });

  it("defaults to '100 g' when no count / serving info", () => {
    const opts = buildPickerOptions({ servingSizeG: null, servingOptions: [] });
    expect(opts.initial).toEqual({ amount: 100, unit: { kind: "gram" } });
  });

  it("rememberedGrams resolves to count units when close to a whole number", () => {
    const opts = buildPickerOptions(meatballProduct, { rememberedGrams: 88 });
    expect(opts.initial.unit.kind).toBe("count");
    if (opts.initial.unit.kind === "count") {
      expect(opts.initial.amount).toBe(4); // 88 / 22 = 4
    }
  });

  it("rememberedGrams falls back to gram when not close to count", () => {
    const opts = buildPickerOptions(meatballProduct, { rememberedGrams: 47 });
    expect(opts.initial.unit.kind).toBe("gram");
    expect(opts.initial.amount).toBe(47);
  });

  it("quick chips include count + gram presets", () => {
    const opts = buildPickerOptions(meatballProduct);
    const labels = opts.quickChips.map((c) => c.label);
    expect(labels).toContain("1 meatball");
    expect(labels).toContain("4 meatballs");
    expect(labels.some((l) => l === "100 g")).toBe(true);
  });
});

describe("stateToGrams + switchUnit (preservation of gram weight)", () => {
  it("3 meatballs → 66 g → 0.76 servings (preserves grams across unit switch)", () => {
    const opts = buildPickerOptions(meatballProduct);
    const meatball = opts.units.find((u) => u.kind === "count")!;
    const serving = opts.units.find((u) => u.kind === "serving")!;
    const start = { amount: 3, unit: meatball };
    expect(stateToGrams(start)).toBeCloseTo(66, 0);

    const inGrams = switchUnit(start, { kind: "gram" });
    expect(stateToGrams(inGrams)).toBeCloseTo(66, 0);
    expect(inGrams.unit.kind).toBe("gram");

    const inServing = switchUnit(start, serving);
    expect(stateToGrams(inServing)).toBeCloseTo(66, 0);
    expect(inServing.unit.kind).toBe("serving");
  });

  it("count unit returns amount × gramsPerUnit", () => {
    const unit: PortionUnit = { kind: "count", singular: "slice", plural: "slices", gramsPerUnit: 25 };
    expect(stateToGrams({ amount: 4, unit })).toBe(100);
  });

  it("ounce unit converts correctly (1 oz = 28.35 g)", () => {
    expect(stateToGrams({ amount: 1, unit: { kind: "ounce" } })).toBeCloseTo(28.35, 1);
  });
});

describe("stepperStep / roundAmount / formatPortion / unitLabel", () => {
  it("step is 1 for count, 0.5 for serving, 5 for gram, 0.5 for ounce", () => {
    expect(stepperStep({ kind: "count", singular: "x", plural: "xs", gramsPerUnit: 10 })).toBe(1);
    expect(stepperStep({ kind: "serving", gramsPerServing: 87 })).toBe(0.5);
    expect(stepperStep({ kind: "gram" })).toBe(5);
    expect(stepperStep({ kind: "ounce" })).toBe(0.5);
  });

  it("rounds count amount to whole when close, else 1 decimal", () => {
    const unit: PortionUnit = { kind: "count", singular: "m", plural: "ms", gramsPerUnit: 22 };
    expect(roundAmount(3.02, unit)).toBe(3);
    expect(roundAmount(3.5, unit)).toBe(3.5);
  });

  it("formats portions naturally", () => {
    const meatball: PortionUnit = { kind: "count", singular: "meatball", plural: "meatballs", gramsPerUnit: 22 };
    expect(formatPortion({ amount: 1, unit: meatball })).toBe("1 meatball");
    expect(formatPortion({ amount: 3, unit: meatball })).toBe("3 meatballs");
    expect(formatPortion({ amount: 100, unit: { kind: "gram" } })).toBe("100 g");
  });

  it("unitLabel switches singular/plural with amount", () => {
    const u: PortionUnit = { kind: "count", singular: "slice", plural: "slices", gramsPerUnit: 25 };
    expect(unitLabel({ amount: 1, unit: u })).toBe("slice");
    expect(unitLabel({ amount: 2, unit: u })).toBe("slices");
    expect(unitLabel({ amount: 1, unit: { kind: "serving", gramsPerServing: 100 } })).toBe("serving");
    expect(unitLabel({ amount: 2, unit: { kind: "serving", gramsPerServing: 100 } })).toBe("servings");
  });
});
