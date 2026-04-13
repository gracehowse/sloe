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
  usFlOzToMl,
} from "@/lib/units/imperial";

describe("kg ↔ lb", () => {
  it("converts 70kg to ~154.3 lb", () => {
    expect(kgToLb(70)).toBeCloseTo(154.32, 1);
  });

  it("converts 154.32 lb to ~70 kg", () => {
    expect(lbToKg(154.32)).toBeCloseTo(70, 0);
  });

  it("round-trips exactly", () => {
    expect(lbToKg(kgToLb(70))).toBeCloseTo(70, 5);
    expect(kgToLb(lbToKg(100))).toBeCloseTo(100, 5);
  });

  it("handles 0", () => {
    expect(kgToLb(0)).toBe(0);
    expect(lbToKg(0)).toBe(0);
  });
});

describe("cm ↔ feet/inches", () => {
  it("170cm = 5 ft 7 in", () => {
    const { feet, inches } = cmToFeetInches(170);
    expect(feet).toBe(5);
    expect(inches).toBe(7);
  });

  it("180cm = 5 ft 11 in", () => {
    const { feet, inches } = cmToFeetInches(180);
    expect(feet).toBe(5);
    expect(inches).toBe(11);
  });

  it("round-trips within 1cm", () => {
    const cm = 175;
    const { feet, inches } = cmToFeetInches(cm);
    expect(feetInchesToCm(feet, inches)).toBeCloseTo(cm, 0);
  });

  it("5 ft 0 in = 152.4cm", () => {
    expect(feetInchesToCm(5, 0)).toBeCloseTo(152.4, 1);
  });
});

describe("ml ↔ fl oz", () => {
  it("29.5735 ml = 1 fl oz", () => {
    expect(mlToUsFlOz(29.5735)).toBeCloseTo(1, 3);
  });

  it("1 fl oz = 29.5735 ml", () => {
    expect(usFlOzToMl(1)).toBeCloseTo(29.5735, 2);
  });

  it("round-trips exactly", () => {
    expect(usFlOzToMl(mlToUsFlOz(500))).toBeCloseTo(500, 5);
  });
});

describe("format labels — metric", () => {
  it("formatHeightLabel metric: exact string", () => {
    expect(formatHeightLabel(180, false)).toBe("180 cm");
    expect(formatHeightLabel(165.7, false)).toBe("166 cm");
  });

  it("formatWeightLabel metric: exact string", () => {
    expect(formatWeightLabel(70, false)).toBe("70.0 kg");
    expect(formatWeightLabel(65.5, false)).toBe("65.5 kg");
  });

  it("formatWaterMl metric: exact string", () => {
    expect(formatWaterMl(500, false)).toBe("500 ml");
    expect(formatWaterMl(2145, false)).toBe("2145 ml");
  });
});

describe("format labels — imperial", () => {
  it("formatHeightLabel imperial: feet and inches", () => {
    expect(formatHeightLabel(180, true)).toBe("5'11\"");
    expect(formatHeightLabel(170, true)).toBe("5'7\"");
  });

  it("formatWeightLabel imperial: pounds", () => {
    const label = formatWeightLabel(70, true);
    expect(label).toBe("154.3 lb");
  });

  it("formatWaterMl imperial: fl oz", () => {
    const label = formatWaterMl(500, true);
    expect(label).toBe("16.9 fl oz");
  });
});
