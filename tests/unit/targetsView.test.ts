import { describe, expect, it } from "vitest";
import {
  activityLevelCaption,
  deficitSurplusCaption,
  buildMacroTiles,
  buildGoalCard,
  formatGoalDate,
} from "../../src/lib/targets/targetsView";

describe("targetsView — activityLevelCaption", () => {
  it("returns the prototype default for moderate / unknown levels", () => {
    expect(activityLevelCaption("moderate")).toBe("moderate activity");
    expect(activityLevelCaption(null)).toBe("moderate activity");
    expect(activityLevelCaption(undefined)).toBe("moderate activity");
  });

  it("maps each activity level to its user-facing label", () => {
    expect(activityLevelCaption("sedentary")).toBe("sedentary activity");
    expect(activityLevelCaption("light")).toBe("light activity");
    expect(activityLevelCaption("active")).toBe("active lifestyle");
    expect(activityLevelCaption("very_active")).toBe("very active lifestyle");
  });
});

describe("targetsView — deficitSurplusCaption", () => {
  it("returns '500 kcal deficit' for a 500 kcal deficit target below TDEE (prototype example)", () => {
    expect(
      deficitSurplusCaption({ targetCalories: 2100, tdeeKcal: 2600, goal: "lose" }),
    ).toBe("500 kcal deficit");
  });

  it("returns a surplus caption when target exceeds TDEE", () => {
    expect(
      deficitSurplusCaption({ targetCalories: 3000, tdeeKcal: 2500, goal: "gain" }),
    ).toBe("500 kcal surplus");
  });

  it("returns null for near-maintenance (|delta| < 50)", () => {
    expect(
      deficitSurplusCaption({ targetCalories: 2400, tdeeKcal: 2380, goal: "maintain" }),
    ).toBeNull();
  });

  it("returns null when inputs are missing / invalid", () => {
    expect(deficitSurplusCaption({ targetCalories: null, tdeeKcal: 2000, goal: "lose" })).toBeNull();
    expect(deficitSurplusCaption({ targetCalories: 2000, tdeeKcal: null, goal: "lose" })).toBeNull();
    expect(deficitSurplusCaption({ targetCalories: 2000, tdeeKcal: 0, goal: "lose" })).toBeNull();
  });
});

describe("targetsView — buildMacroTiles", () => {
  it("produces PROTEIN / CARBS / FAT / FIBER tiles in that order", () => {
    const tiles = buildMacroTiles({
      targets: { protein: 150, carbs: 200, fat: 60, fiber: 30 },
      consumed: { protein: 60, carbs: 100, fat: 30, fiber: 15 },
    });
    expect(tiles.map((t) => t.key)).toEqual(["protein", "carbs", "fat", "fiber"]);
    expect(tiles.map((t) => t.label)).toEqual(["PROTEIN", "CARBS", "FAT", "FIBER"]);
  });

  it("computes current/target and remaining labels", () => {
    const tiles = buildMacroTiles({
      targets: { protein: 150, carbs: 200, fat: 60, fiber: 30 },
      consumed: { protein: 150, carbs: 100, fat: 80, fiber: 0 },
    });
    expect(tiles[0]).toMatchObject({ current: 150, target: 150, pct: 1, remainingLabel: "0g remaining" });
    expect(tiles[1]).toMatchObject({ current: 100, target: 200, remainingLabel: "100g remaining" });
    expect(tiles[2]).toMatchObject({ current: 80, target: 60, remainingLabel: "20g over" });
    expect(tiles[3]).toMatchObject({ current: 0, target: 30, pct: 0 });
  });

  it("clamps pct to [0, 1] and rounds current/target", () => {
    const tiles = buildMacroTiles({
      targets: { protein: 100, carbs: 0, fat: 0, fiber: 0 },
      consumed: { protein: 250, carbs: 0, fat: 0, fiber: 0 },
    });
    expect(tiles[0].pct).toBe(1);
    // Zero target → pct 0, remaining caption still renders.
    expect(tiles[1].pct).toBe(0);
    expect(tiles[1].target).toBe(0);
  });

  // 2026-04-30 (#1): Today applied the net-carbs lens but /targets did
  // not, so the carbs target diverged across the two surfaces (75g vs
  // 91g for the same user). The view-model now accepts the lens flag so
  // both platforms can stay in sync.
  it("when net-carbs lens is enabled, carbs tile shows net carbs and 'NET CARBS' label", () => {
    const tiles = buildMacroTiles({
      targets: { protein: 122, carbs: 91, fat: 31, fiber: 16 },
      consumed: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
      netCarbsLensEnabled: true,
    });
    const carbs = tiles[1];
    expect(carbs.key).toBe("carbs");
    expect(carbs.label).toBe("NET CARBS");
    // 91 − 16 = 75g target, the value Today renders today.
    expect(carbs.target).toBe(75);
    expect(carbs.current).toBe(0);
  });

  it("when lens is disabled, carbs tile renders gross carbs as 'CARBS'", () => {
    const tiles = buildMacroTiles({
      targets: { protein: 122, carbs: 91, fat: 31, fiber: 16 },
      consumed: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
      netCarbsLensEnabled: false,
    });
    const carbs = tiles[1];
    expect(carbs.label).toBe("CARBS");
    expect(carbs.target).toBe(91);
  });

  it("falls back to 'CARBS' label when lens is on but no fibre target is set", () => {
    // The carbsLabel helper refuses to say 'Net carbs' when fibre is
    // 0/missing — applies to targets the same way it applies to row data.
    const tiles = buildMacroTiles({
      targets: { protein: 122, carbs: 91, fat: 31, fiber: 0 },
      consumed: { protein: 0, carbs: 0, fat: 0, fiber: 0 },
      netCarbsLensEnabled: true,
    });
    expect(tiles[1].label).toBe("CARBS");
    expect(tiles[1].target).toBe(91);
  });
});

describe("targetsView — buildGoalCard", () => {
  it("returns null when goal weight is absent", () => {
    expect(
      buildGoalCard({
        currentWeightKg: 74.8,
        goalWeightKg: null,
        weightKgByDay: {},
      }),
    ).toBeNull();
  });

  it("renders 'Reach {goal} kg' + 'Currently {current} kg' when no trend exists yet", () => {
    const card = buildGoalCard({
      currentWeightKg: 74.8,
      goalWeightKg: 72,
      weightKgByDay: {},
    });
    expect(card?.title).toBe("Reach 72 kg");
    expect(card?.subtitle).toBe("Currently 74.8 kg");
    // No trend → stalled.
    expect(card?.status).toBe("stalled");
    expect(card?.statusLabel).toBe("Stalled");
  });

  it("labels 'On track' when the trend is moving toward the goal", () => {
    // 0.5 kg / week loss over 4 weeks → reach 72 from 74.8 in ~5.6 weeks.
    const days: Record<string, number> = {};
    const start = new Date("2026-03-20T12:00:00Z").getTime();
    for (let i = 0; i <= 28; i += 7) {
      const d = new Date(start + i * 86400000);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      days[`${yyyy}-${mm}-${dd}`] = 76.8 - (i / 7) * 0.5;
    }
    const card = buildGoalCard({
      currentWeightKg: 74.8,
      goalWeightKg: 72,
      weightKgByDay: days,
      now: new Date("2026-04-17T12:00:00Z"),
    });
    expect(card?.status).toBe("on_track");
    expect(card?.statusLabel).toBe("On track");
    expect(card?.subtitle).toMatch(/^Currently 74\.8 kg · could reach by ≈ /);
  });

  it("labels 'Off track' when the trend moves away from the goal", () => {
    // Gaining 0.5 kg / wk while the goal is below current → wrong way.
    const days: Record<string, number> = {};
    const start = new Date("2026-03-20T12:00:00Z").getTime();
    for (let i = 0; i <= 28; i += 7) {
      const d = new Date(start + i * 86400000);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      days[`${yyyy}-${mm}-${dd}`] = 73 + (i / 7) * 0.5;
    }
    const card = buildGoalCard({
      currentWeightKg: 75,
      goalWeightKg: 72,
      weightKgByDay: days,
      now: new Date("2026-04-17T12:00:00Z"),
    });
    expect(card?.status).toBe("wrong_way");
    expect(card?.statusLabel).toBe("Off track");
  });

  // Audit 2026-04-29 papercut #8 — capped projections now show a
  // concrete date with a "1+ year out" qualifier rather than the
  // psychologically-deflating "more than a year at current rate".
  it("capped projection shows concrete date + year-qualifier (papercut #8)", () => {
    // Losing 0.1 kg/wk to drop 30 kg ≈ 2,100 days (~5.7 years) — way
    // past the 1-year cap.
    const card = buildGoalCard({
      currentWeightKg: 100,
      goalWeightKg: 70,
      weightKgByDay: {
        "2026-04-12": 100.1,
        "2026-04-19": 100.0,
      },
      now: new Date("2026-04-19T12:00:00Z"),
    });
    expect(card?.subtitle).toMatch(/on track for ≈ /);
    // Expect the year-qualifier ("5+ years out" or "1+ year out").
    expect(card?.subtitle).toMatch(/(\d+\+ years out|1\+ year out)/);
    // Should NOT contain the deflating legacy copy.
    expect(card?.subtitle).not.toMatch(/more than a year at current rate/);
  });
});

describe("targetsView — formatGoalDate", () => {
  it("formats dates as en-GB day + long month", () => {
    expect(formatGoalDate(new Date(Date.UTC(2026, 6, 14, 12, 0, 0)))).toBe("14 July");
    expect(formatGoalDate(new Date(Date.UTC(2026, 0, 3, 12, 0, 0)))).toBe("3 January");
  });
});
