/**
 * ENG-1373 — pins the `maintenanceIntakeFromTargetCalories` "no signal
 * vs. genuinely zero" contract at the pure-function boundary.
 *
 * Bug: the function used to return a literal `0` whenever it had no
 * usable signal (missing/non-positive `targetCalories`, or a
 * pace-adjusted result that nets non-positive). Callers couldn't tell
 * "no data" from "maintenance is actually zero kcal" — nobody's real
 * maintenance is zero — so a UI rendered the literal string
 * "0 kcal maintenance" directly above a separately-resolved
 * "MAINTENANCE 2,117" card for the same account. `null` closes that
 * ambiguity: callers MUST treat `null` as "omit the line".
 */
import { describe, expect, it } from "vitest";

import { maintenanceIntakeFromTargetCalories } from "../../lib/calcTargets";

describe("maintenanceIntakeFromTargetCalories — null vs. zero contract", () => {
  it("returns null (not 0) when targetCalories is non-positive", () => {
    expect(maintenanceIntakeFromTargetCalories(0, "lose", "steady")).toBeNull();
    expect(maintenanceIntakeFromTargetCalories(-100, "lose", "steady")).toBeNull();
  });

  it("returns null (not 0) when targetCalories is non-finite", () => {
    expect(maintenanceIntakeFromTargetCalories(Number.NaN, "lose", "steady")).toBeNull();
    expect(
      maintenanceIntakeFromTargetCalories(Number.POSITIVE_INFINITY, "lose", "steady"),
    ).toBeNull();
  });

  it("returns null (not 0) when the pace-adjusted result nets non-positive", () => {
    // goalCalorieAdjustment("gain", "vigorous") is a large positive surplus
    // adjustment; a small enough targetCalories makes
    // (targetCalories - adjustment) net <= 0.
    const result = maintenanceIntakeFromTargetCalories(100, "gain", "vigorous");
    expect(result).toBeNull();
  });

  it("returns a positive number for a normal lose-goal target", () => {
    // lose/steady applies a -550 kcal adjustment vs. maintenance, so
    // maintenance = targetCalories - (-550) = targetCalories + 550.
    const result = maintenanceIntakeFromTargetCalories(1800, "lose", "steady");
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
    expect(result).toBe(1800 + 550);
  });

  it("never returns a literal 0 for any input — always null or a positive number", () => {
    const cases: Array<[number, string | null, string | null]> = [
      [0, "lose", "steady"],
      [-500, "gain", "relaxed"],
      [1, "gain", "vigorous"],
      [2200, "maintain", "steady"],
      [1500, null, null],
    ];
    for (const [targetCalories, goal, pace] of cases) {
      const result = maintenanceIntakeFromTargetCalories(targetCalories, goal, pace);
      expect(result === null || result > 0).toBe(true);
    }
  });
});
