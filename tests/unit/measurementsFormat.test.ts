/**
 * Action 13 Item #6 + #7 (2026-04-19) — pin the shared
 * `formatWeightForUnit` helper.
 *
 * Bug class: mobile Trend tile + Weight card rendered weight deltas
 * with a hard-coded " kg" suffix even for imperial users. Every other
 * weight surface respected `measurement_system` — Progress was the
 * only place the unit drifted.
 *
 * The helper is the single source of truth for the kg → lb conversion
 * and the unit suffix; both web and mobile call it.
 */
import { describe, expect, it } from "vitest";

import {
  coerceMeasurementSystem,
  formatWeightForUnit,
  kgToLb,
  lbToKg,
} from "../../src/lib/measurements";

describe("formatWeightForUnit (Item #6 + #7)", () => {
  it("metric user sees kg, rounded to 0.1", () => {
    expect(formatWeightForUnit({ kg: 75.42, system: "metric" })).toBe("75.4 kg");
  });

  it("imperial user sees lb, rounded to 0.1", () => {
    // 75 kg × 2.20462 ≈ 165.35 lb → 165.3 / 165.4 depending on rounding
    const out = formatWeightForUnit({ kg: 75, system: "imperial" });
    expect(out).toMatch(/^165\.\d lb$/);
  });

  it("metric user sees a 0.4 kg delta as '0.4 kg' unsigned", () => {
    expect(formatWeightForUnit({ kg: 0.4, system: "metric" })).toBe("0.4 kg");
  });

  it("imperial user sees a 0.4 kg delta as 0.9 lb (0.4 × 2.20462 ≈ 0.88 lb)", () => {
    // 0.4 × 2.20462 = 0.88 → rounded to 1 dp = 0.9
    expect(formatWeightForUnit({ kg: 0.4, system: "imperial" })).toBe("0.9 lb");
  });

  it("signed=true prefixes positive with +, negative with proper minus", () => {
    expect(formatWeightForUnit({ kg: 0.5, system: "metric", signed: true })).toBe(
      "+0.5 kg",
    );
    expect(formatWeightForUnit({ kg: -0.5, system: "metric", signed: true })).toBe(
      "−0.5 kg",
    );
    expect(formatWeightForUnit({ kg: 0, system: "metric", signed: true })).toBe(
      "0 kg",
    );
  });

  it("signed delta in imperial uses lb suffix", () => {
    expect(formatWeightForUnit({ kg: -0.4, system: "imperial", signed: true })).toBe(
      "−0.9 lb",
    );
  });

  it("returns '—' for null / non-finite input rather than '0 kg'", () => {
    expect(formatWeightForUnit({ kg: null, system: "metric" })).toBe("—");
    expect(formatWeightForUnit({ kg: undefined, system: "imperial" })).toBe("—");
    expect(formatWeightForUnit({ kg: Number.NaN, system: "metric" })).toBe("—");
    expect(formatWeightForUnit({ kg: Number.POSITIVE_INFINITY, system: "metric" })).toBe(
      "—",
    );
  });

  it("kgToLb / lbToKg round-trip within 0.1 kg", () => {
    const kg = 80;
    const lb = kgToLb(kg);
    const back = lbToKg(lb);
    expect(Math.abs(back - kg)).toBeLessThanOrEqual(0.1);
  });

  it("coerceMeasurementSystem maps 'imperial' to imperial, everything else to metric", () => {
    expect(coerceMeasurementSystem("imperial")).toBe("imperial");
    expect(coerceMeasurementSystem("metric")).toBe("metric");
    expect(coerceMeasurementSystem(null)).toBe("metric");
    expect(coerceMeasurementSystem(undefined)).toBe("metric");
    expect(coerceMeasurementSystem("garbage")).toBe("metric");
  });
});
