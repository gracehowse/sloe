import { describe, expect, it } from "vitest";
import { calculateMacroTargets, calculateBmrMifflinStJeor } from "@/lib/macros/calculateTargets";

describe("calculateBmrMifflinStJeor", () => {
  it("calculates female BMR correctly", () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 1370.25
    expect(calculateBmrMifflinStJeor({ sex: "female", age: 30, weightKg: 65, heightCm: 165 })).toBeCloseTo(1370.25, 1);
  });

  it("calculates male BMR correctly", () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(calculateBmrMifflinStJeor({ sex: "male", age: 30, weightKg: 80, heightCm: 180 })).toBeCloseTo(1780, 1);
  });

  it("male BMR is higher than female BMR for same stats", () => {
    const male = calculateBmrMifflinStJeor({ sex: "male", age: 30, weightKg: 70, heightCm: 170 });
    const female = calculateBmrMifflinStJeor({ sex: "female", age: 30, weightKg: 70, heightCm: 170 });
    expect(male).toBeGreaterThan(female);
    expect(male - female).toBeCloseTo(166, 0); // +5 vs -161 = 166 difference
  });
});

describe("calculateMacroTargets", () => {
  const typicalFemale = { sex: "female" as const, age: 30, heightCm: 165, weightKg: 65, activityLevel: "moderate" as const, goal: "health" as const };

  it("returns exact values for typical female, moderate, health goal", () => {
    const t = calculateMacroTargets(typicalFemale);
    // BMR=1370.25, TDEE=1370.25*1.55=2123.89, cal=round(2123.89)=2124
    expect(t.calories).toBe(2124);
    expect(t.protein).toBe(143); // round(65*2.2)
    expect(t.fat).toBe(59); // round(2124*0.25/9)
    // carbs = round((2124 - 143*4 - 59*9)/4) = round((2124-572-531)/4) = 255
    expect(t.carbs).toBe(255);
    expect(t.fiber).toBe(30); // round(14*2124/1000) = 30
    expect(t.waterMl).toBe(2145); // round(65*33)
  });

  it("lose goal reduces calories by 15%", () => {
    const t = calculateMacroTargets({ ...typicalFemale, goal: "lose" });
    const tdee = 1370.25 * 1.55;
    expect(t.calories).toBe(Math.round(tdee * 0.85));
  });

  it("strength goal increases calories by 10%", () => {
    const t = calculateMacroTargets({ ...typicalFemale, goal: "strength" });
    const tdee = 1370.25 * 1.55;
    expect(t.calories).toBe(Math.round(tdee * 1.1));
  });

  it("sedentary has lowest calories, very_active highest", () => {
    const sedentary = calculateMacroTargets({ ...typicalFemale, activityLevel: "sedentary" });
    const veryActive = calculateMacroTargets({ ...typicalFemale, activityLevel: "very_active" });
    expect(veryActive.calories).toBeGreaterThan(sedentary.calories);
    expect(veryActive.calories - sedentary.calories).toBeGreaterThan(500);
  });

  it("fiber is clamped between 14 and 45", () => {
    const low = calculateMacroTargets({ ...typicalFemale, activityLevel: "sedentary", goal: "lose", weightKg: 45 });
    expect(low.fiber).toBeGreaterThanOrEqual(14);
    const high = calculateMacroTargets({ ...typicalFemale, activityLevel: "very_active", goal: "strength", weightKg: 120 });
    expect(high.fiber).toBeLessThanOrEqual(45);
  });

  it("waterMl is clamped between 1500 and 4500", () => {
    const light = calculateMacroTargets({ ...typicalFemale, weightKg: 40 });
    expect(light.waterMl).toBeGreaterThanOrEqual(1500);
    const heavy = calculateMacroTargets({ ...typicalFemale, weightKg: 200 });
    expect(heavy.waterMl).toBeLessThanOrEqual(4500);
  });

  it("macros sum approximately to calories (P*4 + C*4 + F*9)", () => {
    const t = calculateMacroTargets(typicalFemale);
    const computed = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    // Should be within 10 cal due to rounding
    expect(Math.abs(computed - t.calories)).toBeLessThan(10);
  });
});
