import { describe, it, expect } from "vitest";
import { getEffectiveTDEE, calculateTDEE } from "@/lib/nutrition/tdee";

describe("getEffectiveTDEE", () => {
  const baseProfile = {
    sex: "male" as const,
    weight_kg: 80,
    height_cm: 180,
    age: 30,
    activity_level: "moderate" as const,
  };

  it("returns static TDEE when no adaptive data", () => {
    const result = getEffectiveTDEE(baseProfile);
    expect(result.isAdaptive).toBe(false);
    expect(result.tdee).toBe(calculateTDEE("male", 80, 180, 30, "moderate"));
  });

  it("returns static TDEE when adaptive confidence is low", () => {
    const result = getEffectiveTDEE({
      ...baseProfile,
      adaptive_tdee: 2500,
      adaptive_tdee_confidence: "low",
    });
    expect(result.isAdaptive).toBe(false);
  });

  it("returns adaptive TDEE when confidence is medium", () => {
    const result = getEffectiveTDEE({
      ...baseProfile,
      adaptive_tdee: 2500,
      adaptive_tdee_confidence: "medium",
    });
    expect(result.isAdaptive).toBe(true);
    expect(result.tdee).toBe(2500);
  });

  it("returns adaptive TDEE when confidence is high", () => {
    const result = getEffectiveTDEE({
      ...baseProfile,
      adaptive_tdee: 2300,
      adaptive_tdee_confidence: "high",
    });
    expect(result.isAdaptive).toBe(true);
    expect(result.tdee).toBe(2300);
  });

  it("returns static TDEE when adaptive_tdee is 0 or null", () => {
    expect(getEffectiveTDEE({ ...baseProfile, adaptive_tdee: 0, adaptive_tdee_confidence: "high" }).isAdaptive).toBe(false);
    expect(getEffectiveTDEE({ ...baseProfile, adaptive_tdee: null, adaptive_tdee_confidence: "high" }).isAdaptive).toBe(false);
  });
});
