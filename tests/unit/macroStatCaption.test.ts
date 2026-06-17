import { describe, expect, it } from "vitest";
import {
  macroStatCaption,
  macroStatProgressRatio,
} from "../../src/lib/nutrition/macroStatCaption";

describe("macroStatCaption (ENG-1014)", () => {
  it("shows full remaining when unlogged (ENG-938 — refugee scannable protein gap)", () => {
    expect(macroStatCaption({ current: 0, target: 120, unit: "g" })).toEqual({
      text: "120g remaining",
      tone: "under",
    });
  });

  it("formats remaining under target", () => {
    expect(macroStatCaption({ current: 80, target: 120, unit: "g" })).toEqual({
      text: "40g remaining",
      tone: "under",
    });
  });

  it("formats over target with flag tone", () => {
    expect(macroStatCaption({ current: 130, target: 120, unit: "g" })).toEqual({
      text: "10g over",
      tone: "over",
    });
  });

  it("keeps under tone for fibre/water wins when overIsFlag is false", () => {
    expect(
      macroStatCaption({
        current: 35,
        target: 30,
        unit: "g",
        overIsFlag: false,
      }),
    ).toEqual({
      text: "5g over",
      tone: "under",
    });
  });

  it("formats reference-only macros", () => {
    expect(
      macroStatCaption({
        current: 12,
        target: 50,
        unit: "g",
        referenceOnly: true,
      }),
    ).toEqual({
      text: "ref 50g",
      tone: "reference",
    });
  });

  it("formats non-gram units with a leading space", () => {
    expect(
      macroStatCaption({ current: 400, target: 2300, unit: "mg" }),
    ).toEqual({
      text: "1900 mg remaining",
      tone: "under",
    });
  });
});

describe("macroStatProgressRatio", () => {
  it("clamps between 0 and 1", () => {
    expect(macroStatProgressRatio(60, 120)).toBeCloseTo(0.5);
    expect(macroStatProgressRatio(200, 120)).toBe(1);
    expect(macroStatProgressRatio(0, 120)).toBe(0);
    expect(macroStatProgressRatio(10, 0)).toBe(0);
  });
});
