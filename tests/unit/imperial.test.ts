import { describe, expect, it } from "vitest";
import {
  cmToFeetInches,
  feetInchesToCm,
  formatHeightLabel,
  formatWaterMl,
  formatWeightLabel,
  kgToLb,
  lbToKg,
  mlToUsFlOz,
} from "@/lib/units/imperial";

describe("imperial helpers", () => {
  it("converts kg/lb round trip", () => {
    expect(lbToKg(kgToLb(70))).toBeCloseTo(70, 5);
  });

  it("converts cm to feet/inches", () => {
    const { feet, inches } = cmToFeetInches(170);
    expect(feet).toBe(5);
    expect(inches).toBe(7);
    expect(feetInchesToCm(5, 7)).toBeCloseTo(170, 0);
  });

  it("formats labels", () => {
    expect(formatHeightLabel(180, false)).toBe("180 cm");
    expect(formatWeightLabel(70, false)).toMatch(/kg/);
    expect(formatWaterMl(500, false)).toMatch(/500/);
    expect(mlToUsFlOz(29.5735)).toBeCloseTo(1, 3);
  });
});
