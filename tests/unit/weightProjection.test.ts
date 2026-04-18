import { describe, expect, it } from "vitest";
import { projectWeight } from "../../src/lib/weightProjection";

describe("projectWeight — direction classifier", () => {
  it("respects an explicit maintenanceTdeeKcal over the goal heuristic", () => {
    // TestFlight build 7 `ALkK-XrcMz_V-D6NrjuVYbo`: user is on a "lose" goal
    // with a 1500 kcal target but their real TDEE (adaptive) is 2800. They
    // ate 1900 — clearly in deficit. The pre-fix heuristic would have used
    // target + 500 = 2000 as the break-even and flagged this as "gain".
    const { direction, dailySurplusDeficit } = projectWeight({
      currentWeightKg: 75,
      todayCalories: 1900,
      targetCalories: 1500,
      maintenanceTdeeKcal: 2800,
      goal: "lose",
    });
    expect(direction).toBe("deficit");
    expect(dailySurplusDeficit).toBe(1900 - 2800);
  });

  it("falls back to target + 500 for lose goal when maintenanceTdeeKcal is missing", () => {
    const { direction } = projectWeight({
      currentWeightKg: 75,
      todayCalories: 2100,
      targetCalories: 1500,
      goal: "lose",
    });
    // 2100 vs fallback 2000 → surplus > 50 threshold.
    expect(direction).toBe("surplus");
  });

  it("ignores maintenanceTdeeKcal when zero or non-finite", () => {
    for (const bad of [0, -100, Number.NaN, null, undefined]) {
      const { direction } = projectWeight({
        currentWeightKg: 75,
        todayCalories: 1500,
        targetCalories: 1500,
        maintenanceTdeeKcal: bad as number | null | undefined,
        goal: "maintain",
      });
      // With maintain + matching target the fallback still produces maintenance.
      expect(direction).toBe("maintenance");
    }
  });

  it("classifies as maintenance when |surplus/deficit| < 50 kcal", () => {
    const { direction } = projectWeight({
      currentWeightKg: 75,
      todayCalories: 2030,
      targetCalories: 2000,
      maintenanceTdeeKcal: 2000,
      goal: "maintain",
    });
    expect(direction).toBe("maintenance");
  });

  it("projects a lower weight when the user is truly in deficit vs their real TDEE", () => {
    const { projectedWeightKg } = projectWeight({
      currentWeightKg: 80,
      todayCalories: 2000,
      targetCalories: 1800,
      maintenanceTdeeKcal: 2700, // real burn
      goal: "lose",
      weeksOut: 5,
    });
    // Deficit = 2000 - 2700 = -700 kcal/day × 35 days = -24,500 kcal.
    // -24,500 / 7700 kcal/kg ≈ -3.18 kg → 80 - 3.18 ≈ 76.8.
    expect(projectedWeightKg).toBeLessThan(80);
    expect(projectedWeightKg).toBeGreaterThan(75);
  });
});
