import { describe, expect, it } from "vitest";

import { computeActivityBonusKcal } from "../../src/lib/nutrition/activityBonus";

/**
 * Pins the projected-EOD bonus formula adopted on 2026-05-13. Inputs
 * mirror Grace's TestFlight report from 2026-05-13 19:49 so any future
 * regression that resurrects the "bonus so far" path will trip this
 * test instead of shipping silently.
 */
describe("computeActivityBonusKcal — Lose It! projected-EOD model", () => {
  it("Grace's 19:49 case: 1131 resting + 495 active vs 1653 maintenance → +213", () => {
    const result = computeActivityBonusKcal({
      prefer: true,
      dateKey: "2026-05-13",
      todayDateKey: "2026-05-13",
      restingKcal: 1131,
      activeKcal: 495,
      maintenanceKcal: 1653,
      now: new Date("2026-05-13T19:49:00"),
    });
    // basal 1131 / (19 + 49/60 = 19.8167h) ≈ 57.07 kcal/h resting
    // futureBurn = round(57.07 * (24 − 19.8167)) = round(238.69) = 239
    // projected = 1131 + 495 + 239 = 1865
    // bonus = max(0, 1865 − 1653) = 212
    // (We allow ±1 kcal for proration rounding differences in production.)
    expect(result).toBeGreaterThanOrEqual(211);
    expect(result).toBeLessThanOrEqual(214);
  });

  it("past day collapses to actual − maintenance (no future component)", () => {
    const result = computeActivityBonusKcal({
      prefer: true,
      dateKey: "2026-05-12",
      todayDateKey: "2026-05-13",
      restingKcal: 1421,
      activeKcal: 523,
      maintenanceKcal: 1766,
      // `now` deliberately set to today — past-day path must ignore it.
      now: new Date("2026-05-13T19:49:00"),
    });
    // 1421 + 523 − 1766 = 178
    expect(result).toBe(178);
  });

  it("returns 0 when prefer is off, even when burn exceeds maintenance", () => {
    const result = computeActivityBonusKcal({
      prefer: false,
      dateKey: "2026-05-13",
      todayDateKey: "2026-05-13",
      restingKcal: 1131,
      activeKcal: 495,
      maintenanceKcal: 1653,
      now: new Date("2026-05-13T19:49:00"),
    });
    expect(result).toBe(0);
  });

  it("returns 0 when active is 0 (avoid rewarding pure resting)", () => {
    const result = computeActivityBonusKcal({
      prefer: true,
      dateKey: "2026-05-13",
      todayDateKey: "2026-05-13",
      restingKcal: 1131,
      activeKcal: 0,
      maintenanceKcal: 1653,
      now: new Date("2026-05-13T19:49:00"),
    });
    expect(result).toBe(0);
  });

  it("falls back to workout calories when no resting data", () => {
    const result = computeActivityBonusKcal({
      prefer: true,
      dateKey: "2026-05-13",
      todayDateKey: "2026-05-13",
      restingKcal: 0,
      activeKcal: 300,
      maintenanceKcal: 1653,
      workoutKcal: 300,
      now: new Date("2026-05-13T19:49:00"),
    });
    expect(result).toBe(300);
  });

  it("clamps to 0 when projected burn is below maintenance (early in day)", () => {
    const result = computeActivityBonusKcal({
      prefer: true,
      dateKey: "2026-05-13",
      todayDateKey: "2026-05-13",
      restingKcal: 200, // ~ 3h of resting at usual rate
      activeKcal: 50,
      maintenanceKcal: 2200,
      now: new Date("2026-05-13T03:00:00"),
    });
    // hoursElapsed = 3 → hourlyResting = 66.7 → futureBurn = 1400
    // projected = 200 + 50 + 1400 = 1650, below maintenance 2200
    expect(result).toBe(0);
  });

  it("bonus shrinks through the evening when no further activity is logged", () => {
    const morning = computeActivityBonusKcal({
      prefer: true,
      dateKey: "2026-05-13",
      todayDateKey: "2026-05-13",
      restingKcal: 660,
      activeKcal: 500,
      maintenanceKcal: 1700,
      now: new Date("2026-05-13T12:00:00"),
    });
    const evening = computeActivityBonusKcal({
      prefer: true,
      dateKey: "2026-05-13",
      todayDateKey: "2026-05-13",
      restingKcal: 1200, // more accumulated resting by 22:00
      activeKcal: 500, // unchanged — no further activity
      maintenanceKcal: 1700,
      now: new Date("2026-05-13T22:00:00"),
    });
    // Morning projection includes lots of future-resting at noon-rate;
    // evening projection has less time left and lower hourly rate.
    expect(morning).toBeGreaterThan(evening);
  });
});
