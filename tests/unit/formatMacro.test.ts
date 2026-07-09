/**
 * Polish (2026-04-25) — formatMacro / formatMacroValue contract.
 *
 * Bug pinned: floats like 105.80000000000001 leaked to the UI as
 * "C 105.80000000000001g" because each render site rolled its own
 * Math.round. Centralised helper ensures protein/carbs/fat keep 1-decimal
 * precision (no trailing ".0"), calories+sodium stay integer, and zero is
 * always rendered as "0".
 */
import { describe, it, expect } from "vitest";
import { formatMacro, formatMacroValue, formatQualifiedKcal } from "../../src/lib/nutrition/formatMacro";

describe("formatMacroValue", () => {
  it("rounds calories and sodium to integer", () => {
    expect(formatMacroValue(105.8, "calories")).toBe(106);
    expect(formatMacroValue(2299.7, "sodium")).toBe(2300);
    expect(formatMacroValue(0.4, "calories")).toBe(0);
  });

  it("rounds protein/carbs/fat/fibre/sugar to 1 decimal", () => {
    expect(formatMacroValue(105.8, "carbs")).toBe(105.8);
    expect(formatMacroValue(105.84, "carbs")).toBe(105.8);
    expect(formatMacroValue(105.85, "carbs")).toBe(105.9);
    expect(formatMacroValue(12.4567, "protein")).toBe(12.5);
    expect(formatMacroValue(7.0, "fat")).toBe(7);
    expect(formatMacroValue(2.55, "fiber")).toBe(2.6);
  });

  it("strips floating-point junk (the bug we're fixing)", () => {
    // The exact value Grace screenshotted: 105.80000000000001 → 105.8
    expect(formatMacroValue(105.80000000000001, "carbs")).toBe(105.8);
    // 0.30000000000000004 (classic JS 0.1 + 0.2) → 0.3
    expect(formatMacroValue(0.30000000000000004, "fat")).toBe(0.3);
  });

  it("returns 0 for null / undefined / NaN / Infinity", () => {
    expect(formatMacroValue(null, "protein")).toBe(0);
    expect(formatMacroValue(undefined, "calories")).toBe(0);
    expect(formatMacroValue(NaN, "carbs")).toBe(0);
    expect(formatMacroValue(Infinity, "fat")).toBe(0);
  });
});

describe("formatMacro", () => {
  it("returns a display string with optional unit", () => {
    expect(formatMacro(105.8, "carbs")).toBe("105.8");
    expect(formatMacro(105.8, "carbs", "g")).toBe("105.8g");
    expect(formatMacro(2300, "sodium", "mg")).toBe("2300mg");
  });

  it("trims trailing .0 for 1-decimal macros (105.0 → '105')", () => {
    expect(formatMacro(105.0, "protein")).toBe("105");
    expect(formatMacro(105, "protein")).toBe("105");
    expect(formatMacro(7.0, "fat", "g")).toBe("7g");
  });

  it("renders integer macros without decimals", () => {
    expect(formatMacro(106, "calories")).toBe("106");
    expect(formatMacro(0, "calories")).toBe("0");
  });

  it("zero renders as '0' regardless of macro key", () => {
    expect(formatMacro(0, "protein")).toBe("0");
    expect(formatMacro(0, "calories", "kcal")).toBe("0kcal");
  });
});

describe("formatQualifiedKcal (ENG-1417)", () => {
  it("renders the bare number when verified", () => {
    expect(formatQualifiedKcal(698, true)).toBe("698");
    expect(formatQualifiedKcal(1900, true)).toBe("1,900");
  });

  it("prefixes with '~' when unverified", () => {
    expect(formatQualifiedKcal(698, false)).toBe("~698");
    expect(formatQualifiedKcal(1900, false)).toBe("~1,900");
  });

  it("treats absent/undefined/null isVerified as unverified (safe default)", () => {
    expect(formatQualifiedKcal(698, undefined)).toBe("~698");
    expect(formatQualifiedKcal(698, null)).toBe("~698");
  });

  it("reuses formatKcalDisplay's rounding + comma formatting", () => {
    expect(formatQualifiedKcal(105.8, false)).toBe("~106");
    expect(formatQualifiedKcal(null, false)).toBe("~0");
  });
});
