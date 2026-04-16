/**
 * Tests for the shared activityBudgetAddon function.
 * surplus-only bonus: only adds burn above estimated maintenance.
 */
import { describe, it, expect } from "vitest";
import { activityBudgetAddon } from "@/lib/nutrition/activityBudgetAddon";

describe("activityBudgetAddon", () => {
  it("returns 0 when prefer is false", () => {
    expect(activityBudgetAddon({
      prefer: false, activityBurn: 500, basalBurn: 1400, maintenanceKcal: 2000,
    })).toBe(0);
  });

  it("returns 0 when active burn is 0", () => {
    expect(activityBudgetAddon({
      prefer: true, activityBurn: 0, basalBurn: 1400, maintenanceKcal: 2000,
    })).toBe(0);
  });

  it("bonus = totalBurn - maintenance when exceeds", () => {
    // 1600 resting + 600 active = 2200 total, maintenance 2000 → bonus 200
    expect(activityBudgetAddon({
      prefer: true, activityBurn: 600, basalBurn: 1600, maintenanceKcal: 2000,
    })).toBe(200);
  });

  it("bonus is 0 when total burn is below maintenance", () => {
    // 1200 + 200 = 1400 < 2000
    expect(activityBudgetAddon({
      prefer: true, activityBurn: 200, basalBurn: 1200, maintenanceKcal: 2000,
    })).toBe(0);
  });

  it("uses workout calories only when no basal data", () => {
    expect(activityBudgetAddon({
      prefer: true, activityBurn: 300, basalBurn: 0, maintenanceKcal: 2000,
      workoutCalories: 250,
    })).toBe(250);
  });

  it("returns 0 when no basal and no workout data", () => {
    expect(activityBudgetAddon({
      prefer: true, activityBurn: 300, basalBurn: 0, maintenanceKcal: 2000,
    })).toBe(0);
  });

  it("bonus is exactly the surplus, not more", () => {
    // 1500 + 550 = 2050, maintenance 2000 → exactly 50
    expect(activityBudgetAddon({
      prefer: true, activityBurn: 550, basalBurn: 1500, maintenanceKcal: 2000,
    })).toBe(50);
  });
});
