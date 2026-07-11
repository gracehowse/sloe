/**
 * ENG-1506 — canonical energy-number layer (`selectMaintenance` input
 * policy + qualifier + resolver-sourced expenditure copy).
 *
 * The load-bearing regression here is the 1,567-vs-1,778 audit split:
 * two surfaces calling the byte-identical resolver printed different
 * maintenance numbers because one fed the stale `profiles.weight_kg`
 * snapshot and the other the latest weigh-in — and since `formulaKcal`
 * is both the fallback AND the ENG-1057 floor, the weight skew FLIPPED
 * which branch won. `buildMaintenanceInputs` kills the skew by deciding
 * the weight policy exactly once.
 */

import { describe, expect, it } from "vitest";

import {
  ENERGY_NUMBERS_V1_FLAG,
  buildMaintenanceInputs,
  expenditureFromResolved,
  maintenanceQualifier,
  parseWeightKgByDayMap,
  selectMaintenance,
} from "../../src/lib/nutrition/energyNumbers";
import { resolveMaintenance } from "../../src/lib/nutrition/resolveMaintenance";

const NOW = new Date("2026-07-11T12:00:00Z");
const FRESH_ISO = "2026-07-10T12:00:00Z";

describe("energyNumbers — buildMaintenanceInputs (the input policy)", () => {
  it("prefers the latest weight_kg_by_day entry over the profile snapshot", () => {
    const inputs = buildMaintenanceInputs({
      weight_kg: 80,
      weight_kg_by_day: { "2026-07-01": 62, "2026-07-10": 60 },
    });
    expect(inputs.weight_kg).toBe(60);
  });

  it("falls back to the profile snapshot when the by-day map is empty/malformed", () => {
    expect(buildMaintenanceInputs({ weight_kg: 80, weight_kg_by_day: {} }).weight_kg).toBe(80);
    expect(buildMaintenanceInputs({ weight_kg: 80, weight_kg_by_day: "junk" }).weight_kg).toBe(80);
    expect(buildMaintenanceInputs({ weight_kg: 80 }).weight_kg).toBe(80);
  });

  it("NEVER fabricates: no weight anywhere → null weight → resolver returns null", () => {
    const inputs = buildMaintenanceInputs({ sex: "male", height_cm: 180, age: 30 });
    expect(inputs.weight_kg).toBeNull();
    expect(selectMaintenance({ sex: "male", height_cm: 180, age: 30 }, { now: NOW })).toBeNull();
  });

  it("strict-null body basics — no 'unspecified'/170/30 defaults", () => {
    const inputs = buildMaintenanceInputs({ weight_kg: 70 });
    expect(inputs.sex).toBeNull();
    expect(inputs.height_cm).toBeNull();
    expect(inputs.age).toBeNull();
    expect(inputs.activity_level).toBeNull();
  });

  it("coerces raw-row string numerics and rejects non-positive values", () => {
    const inputs = buildMaintenanceInputs({
      weight_kg: "72.5",
      height_cm: "180",
      age: "31",
      sex: " Male ",
      activity_level: "SEDENTARY",
      adaptive_tdee: "2100",
    });
    expect(inputs.weight_kg).toBe(72.5);
    expect(inputs.height_cm).toBe(180);
    expect(inputs.age).toBe(31);
    expect(inputs.sex).toBe("male");
    expect(inputs.activity_level).toBe("sedentary");
    expect(inputs.adaptive_tdee).toBe(2100);
    expect(buildMaintenanceInputs({ weight_kg: 0 }).weight_kg).toBeNull();
    expect(buildMaintenanceInputs({ weight_kg: -4 }).weight_kg).toBeNull();
  });

  it("parseWeightKgByDayMap drops non-finite / non-positive entries", () => {
    expect(
      parseWeightKgByDayMap({ a: 70, b: "71", c: 0, d: -1, e: "junk" }),
    ).toEqual({ a: 70, b: 71 });
  });
});

describe("energyNumbers — the 1,567/1,778 branch-flip regression", () => {
  // Male, 180 cm, 30 y. Sedentary formula = (10w + 980) × 1.2 = 12w + 1176.
  //   snapshot weight 80 kg → formula 2136 (floor ABOVE the candidate)
  //   latest weigh-in 60 kg → formula 1896 (floor BELOW the candidate)
  const row = {
    sex: "male",
    height_cm: 180,
    age: 30,
    weight_kg: 80,
    weight_kg_by_day: { "2026-07-10": 60 },
    adaptive_tdee: 2000,
    adaptive_tdee_confidence: "high",
    adaptive_tdee_updated_at: FRESH_ISO,
  };

  it("documents the legacy split: divergent weight inputs flip the ENG-1057 floor", () => {
    const base = buildMaintenanceInputs(row);
    // Legacy web Progress fed the snapshot → floor 2136 rejects adaptive 2000.
    const webLegacy = resolveMaintenance({ ...base, weight_kg: 80 }, { now: NOW });
    expect(webLegacy?.source).toBe("formula");
    expect(webLegacy?.kcal).toBe(2136);
    // Legacy mobile Progress fed the latest weigh-in → adaptive 2000 accepted.
    const mobileLegacy = resolveMaintenance({ ...base, weight_kg: 60 }, { now: NOW });
    expect(mobileLegacy?.source).toBe("adaptive");
    expect(mobileLegacy?.kcal).toBe(2000);
    // Same resolver, same profile row, two different numbers — the audit bug.
    expect(webLegacy?.kcal).not.toBe(mobileLegacy?.kcal);
  });

  it("selectMaintenance yields ONE value for the same row, whoever calls it", () => {
    const a = selectMaintenance(row, { now: NOW });
    const b = selectMaintenance({ ...row }, { now: NOW });
    expect(a?.kcal).toBe(2000);
    expect(a?.source).toBe("adaptive");
    expect(b).toEqual(a);
  });
});

describe("energyNumbers — maintenanceQualifier", () => {
  it("one grammar per source", () => {
    expect(maintenanceQualifier("measured", "high")).toEqual({
      pill: "Apple Health",
      line: "Apple Health · high confidence",
    });
    expect(maintenanceQualifier("adaptive", "medium")).toEqual({
      pill: "Adaptive",
      line: "From your logs · medium confidence",
    });
    expect(maintenanceQualifier("formula", null)).toEqual({
      pill: "Formula estimate",
      line: "Formula estimate from your stats",
    });
  });
});

describe("energyNumbers — expenditureFromResolved (resolver-sourced copy)", () => {
  const resolvedAdaptive = selectMaintenance(
    {
      sex: "male",
      height_cm: 180,
      age: 30,
      weight_kg: 60,
      adaptive_tdee: 2004,
      adaptive_tdee_confidence: "medium",
      adaptive_tdee_updated_at: FRESH_ISO,
    },
    { now: NOW },
  );

  it("adaptive: number ties to resolved.kcal (rounded to 10), chip = REAL confidence", () => {
    const copy = expenditureFromResolved(resolvedAdaptive, FRESH_ISO, { now: NOW.getTime() });
    expect(resolvedAdaptive?.kcal).toBe(2004);
    expect(copy.source).toBe("adaptive");
    expect(copy.roundedKcal).toBe(2000);
    expect(copy.line).toContain("~2,000 kcal/day");
    expect(copy.chipLevel).toBe("medium");
  });

  it("measured copy renders ONLY when the resolver itself selected measured", () => {
    const resolvedMeasured = selectMaintenance(
      {
        sex: "male",
        height_cm: 180,
        age: 30,
        weight_kg: 60,
        measured_tdee: 2412,
        measured_tdee_confidence: "medium",
        measured_tdee_updated_at: FRESH_ISO,
      },
      { now: NOW, enableMeasured: true },
    );
    expect(resolvedMeasured?.source).toBe("measured");
    const copy = expenditureFromResolved(resolvedMeasured, null, { now: NOW.getTime() });
    expect(copy.source).toBe("measured");
    expect(copy.roundedKcal).toBe(2410);
    // The hard-coded "high" chip is dead: the chip is the real confidence.
    expect(copy.chipLevel).toBe("medium");
  });

  it("formula / null resolution → the honest learning state, no number", () => {
    const resolvedFormula = selectMaintenance(
      { sex: "male", height_cm: 180, age: 30, weight_kg: 60 },
      { now: NOW },
    );
    expect(resolvedFormula?.source).toBe("formula");
    for (const resolved of [resolvedFormula, null]) {
      const copy = expenditureFromResolved(resolved, null, { now: NOW.getTime() });
      expect(copy.source).toBe("none");
      expect(copy.roundedKcal).toBeNull();
      expect(copy.line).toContain("still learning");
    }
  });

  it("structural invariant: the card can never emit a kcal ≠ the resolved maintenance", () => {
    for (const resolved of [resolvedAdaptive]) {
      const copy = expenditureFromResolved(resolved, FRESH_ISO, { now: NOW.getTime() });
      expect(copy.roundedKcal).toBe(Math.round((resolved!.kcal) / 10) * 10);
    }
  });
});

describe("energyNumbers — flag registration", () => {
  it("exports the default-OFF rollout flag name", () => {
    expect(ENERGY_NUMBERS_V1_FLAG).toBe("energy_numbers_v1");
  });
});
