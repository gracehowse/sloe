/**
 * ENG-1373 — reconciliation tests for the goal-weight-data gate.
 *
 * Pins:
 *   - `hasGoalWeightData` truth table (both operands must be present).
 *   - `computeTrajectory` sets `goalIndependent` to disclose whether a
 *     rendered projection had a goal weight to work from, WITHOUT
 *     gating the projection itself on goal data (pace projections are
 *     legitimately goal-independent for maintain-weight users).
 */
import { describe, expect, it } from "vitest";

import {
  computeTrajectory,
  hasGoalWeightData,
} from "../../src/lib/weightProjection";

describe("hasGoalWeightData", () => {
  it("returns true when both goalWeightKg and latestWeightKg are present", () => {
    expect(
      hasGoalWeightData({ goalWeightKg: 66, latestWeightKg: 70.2 }),
    ).toBe(true);
  });

  it("returns false when goalWeightKg is null", () => {
    expect(
      hasGoalWeightData({ goalWeightKg: null, latestWeightKg: 70.2 }),
    ).toBe(false);
  });

  it("returns false when latestWeightKg is null", () => {
    expect(
      hasGoalWeightData({ goalWeightKg: 66, latestWeightKg: null }),
    ).toBe(false);
  });

  it("returns false when both are null", () => {
    expect(
      hasGoalWeightData({ goalWeightKg: null, latestWeightKg: null }),
    ).toBe(false);
  });

  it("returns false for non-finite values", () => {
    expect(
      hasGoalWeightData({ goalWeightKg: Number.NaN, latestWeightKg: 70 }),
    ).toBe(false);
    expect(
      hasGoalWeightData({ goalWeightKg: 66, latestWeightKg: Number.POSITIVE_INFINITY }),
    ).toBe(false);
  });
});

describe("computeTrajectory — goalIndependent disclosure", () => {
  // ≥5 food-logged days with a real average, so the projection path
  // (not the placeholder path) is exercised.
  const byDay: Record<string, Array<{ calories: number }>> = {
    "2026-04-01": [{ calories: 1900 }],
    "2026-04-02": [{ calories: 2000 }],
    "2026-04-03": [{ calories: 2100 }],
    "2026-04-04": [{ calories: 1950 }],
    "2026-04-05": [{ calories: 2050 }],
  };

  it("sets goalIndependent: true when goalWeightKg is omitted", () => {
    const state = computeTrajectory({
      byDay,
      latestWeightKg: 80,
      targetCalories: 2000,
      maintenanceTdeeKcal: 2500,
    });
    expect(state).not.toBeNull();
    expect(state!.kind).toBe("projection");
    if (state!.kind === "projection") {
      expect(state!.goalIndependent).toBe(true);
    }
  });

  it("sets goalIndependent: true when goalWeightKg is explicitly null", () => {
    const state = computeTrajectory({
      byDay,
      latestWeightKg: 80,
      targetCalories: 2000,
      maintenanceTdeeKcal: 2500,
      goalWeightKg: null,
    });
    expect(state).not.toBeNull();
    if (state!.kind === "projection") {
      expect(state!.goalIndependent).toBe(true);
    }
  });

  it("sets goalIndependent: false when a goalWeightKg is supplied", () => {
    const state = computeTrajectory({
      byDay,
      latestWeightKg: 80,
      targetCalories: 2000,
      maintenanceTdeeKcal: 2500,
      goalWeightKg: 70,
    });
    expect(state).not.toBeNull();
    expect(state!.kind).toBe("projection");
    if (state!.kind === "projection") {
      expect(state!.goalIndependent).toBe(false);
    }
  });

  it("still renders a projection (never gates on goal data) when goalWeightKg is missing", () => {
    // The pace projection must still compute — GOAL/RATE cards may be
    // suppressed elsewhere on the same screen via hasGoalWeightData,
    // but Trajectory is intentionally goal-independent.
    const state = computeTrajectory({
      byDay,
      latestWeightKg: 80,
      targetCalories: 2000,
      maintenanceTdeeKcal: 2500,
    });
    expect(state).not.toBeNull();
    expect(state!.kind).toBe("projection");
  });
});
