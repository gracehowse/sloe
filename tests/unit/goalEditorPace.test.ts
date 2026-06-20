/**
 * goalEditorPace — shared pace seating / dirty-tracking / body-field
 * parsing for the post-onboarding "Edit goal & pace" editor (Stage 2 of
 * the target-recompute unification, 2026-05-26).
 *
 * These pure helpers are the contract both editor UIs (web dialog +
 * mobile sheet/hook) build on, so pinning them here proves web == mobile
 * for the seat + dirty + parse logic without rendering either UI.
 */
import { describe, expect, it } from "vitest";
import {
  canSaveBelowFloor,
  dbGoalToSliderGoal,
  defaultPaceForDbGoal,
  fiberGoalChanged,
  paceChanged,
  paceForPreset,
  paceRangeForDbGoal,
  parseFiberInputToG,
  parseGoalEditorProfileRow,
  parseHeightInputToCm,
  parseWeightInputToKg,
  safetyAckBody,
  seatPaceForEditor,
  normalizeEditorGoal,
  SAFETY_ACK_CONFIRM_LABEL,
  SAFETY_ACK_TITLE,
} from "../../src/lib/nutrition/goalEditorPace";
import { lbToKg, feetInchesToCm } from "../../src/lib/units/imperial";
import { PACE_RANGES } from "../../src/lib/onboarding/state";

describe("goalEditorPace — goal ↔ slider mapping", () => {
  it("maps DB goals to the onboarding slider vocabulary", () => {
    expect(dbGoalToSliderGoal("cut")).toBe("lose");
    expect(dbGoalToSliderGoal("bulk")).toBe("gain");
    expect(dbGoalToSliderGoal("maintain")).toBe("maintain");
  });

  it("borrows the exact onboarding slider ranges (no drift)", () => {
    expect(paceRangeForDbGoal("cut")).toEqual(PACE_RANGES.lose);
    expect(paceRangeForDbGoal("bulk")).toEqual(PACE_RANGES.gain);
  });

  it("normalizes legacy goal labels", () => {
    expect(normalizeEditorGoal("lose")).toBe("cut");
    expect(normalizeEditorGoal("recomp")).toBe("cut");
    expect(normalizeEditorGoal("gain")).toBe("bulk");
    expect(normalizeEditorGoal("health")).toBe("maintain");
    expect(normalizeEditorGoal(null)).toBe("cut");
  });
});

describe("goalEditorPace — seating the slider", () => {
  it("seats from the stored continuous pace_kg_per_week when present", () => {
    // 0.42 is a value no preset snaps to exactly — proves we use the
    // lossless value, not the snapped preset (the 901→846 drift fix).
    const seat = seatPaceForEditor({ goal: "cut", paceKgPerWeek: 0.42, planPace: "steady" });
    expect(seat).toBe(0.42);
  });

  it("falls back to the plan_pace preset when pace_kg_per_week is NULL", () => {
    // Existing users pre-migration: infer from the preset (relaxed .25 /
    // steady .5 / accelerated .75 / vigorous 1.0), clamped into range.
    expect(seatPaceForEditor({ goal: "cut", paceKgPerWeek: null, planPace: "relaxed" })).toBe(
      0.25,
    );
    // steady = 0.5; cut range max is 0.75, so it's not clamped.
    expect(seatPaceForEditor({ goal: "cut", paceKgPerWeek: null, planPace: "steady" })).toBe(0.5);
    expect(paceForPreset("accelerated")).toBe(0.75);
  });

  it("clamps an out-of-range stored pace into the goal's slider range", () => {
    // vigorous = 1.0 kg/week, but the cut slider max is 0.75 — the thumb
    // must seat at the max, never off-track.
    const seat = seatPaceForEditor({ goal: "cut", paceKgPerWeek: 1.0, planPace: "vigorous" });
    expect(seat).toBe(PACE_RANGES.lose.max);
    expect(seat).toBe(0.75);
  });

  it("seats maintain at 0 regardless of stored pace", () => {
    expect(
      seatPaceForEditor({ goal: "maintain", paceKgPerWeek: 0.5, planPace: "steady" }),
    ).toBe(0);
  });

  it("falls back to the goal default when neither pace signal is present", () => {
    const seat = seatPaceForEditor({ goal: "bulk", paceKgPerWeek: null, planPace: null as never });
    expect(seat).toBe(defaultPaceForDbGoal("bulk"));
  });
});

describe("goalEditorPace — dirty tracking (no-op save must not drift)", () => {
  it("an unmoved slider is NOT dirty", () => {
    const seat = seatPaceForEditor({ goal: "cut", paceKgPerWeek: 0.42, planPace: "steady" });
    // Opening + saving without touching the slider: current === seated.
    expect(paceChanged(seat, seat)).toBe(false);
  });

  it("a seated-from-preset pace is NOT dirty until moved", () => {
    const seat = seatPaceForEditor({ goal: "cut", paceKgPerWeek: null, planPace: "steady" });
    expect(paceChanged(seat, seat)).toBe(false);
  });

  it("a real slider move IS dirty (smallest step registers)", () => {
    // gain step is the finest at 0.025.
    expect(paceChanged(0.25, 0.275)).toBe(true);
    expect(paceChanged(0.5, 0.55)).toBe(true);
  });

  it("ignores float pollution below half a thousandth", () => {
    expect(paceChanged(0.5, 0.50001)).toBe(false);
  });
});

describe("goalEditorPace — body-field parsing", () => {
  it("parses a metric weight to kg", () => {
    expect(parseWeightInputToKg("72.4", "metric", lbToKg)).toBe(72.4);
  });

  it("parses an imperial weight back to kg (rounded 1dp)", () => {
    // 160 lb ≈ 72.6 kg.
    expect(parseWeightInputToKg("160", "imperial", lbToKg)).toBe(72.6);
  });

  it("returns null for blank / non-positive / garbage weight", () => {
    expect(parseWeightInputToKg("", "metric", lbToKg)).toBeNull();
    expect(parseWeightInputToKg("0", "metric", lbToKg)).toBeNull();
    expect(parseWeightInputToKg("-5", "metric", lbToKg)).toBeNull();
    expect(parseWeightInputToKg("abc", "metric", lbToKg)).toBeNull();
  });

  it("parses metric height to whole cm", () => {
    expect(
      parseHeightInputToCm({ measurementSystem: "metric", cm: "170.6" }, feetInchesToCm),
    ).toBe(171);
  });

  it("parses imperial feet+inches to cm", () => {
    // 5'7" ≈ 170 cm.
    expect(
      parseHeightInputToCm(
        { measurementSystem: "imperial", feet: "5", inches: "7" },
        feetInchesToCm,
      ),
    ).toBe(170);
  });

  it("treats blank inches as 0 (flat feet) but requires feet", () => {
    // 6'0".
    expect(
      parseHeightInputToCm(
        { measurementSystem: "imperial", feet: "6", inches: "" },
        feetInchesToCm,
      ),
    ).toBe(183);
    // No feet → null.
    expect(
      parseHeightInputToCm(
        { measurementSystem: "imperial", feet: "", inches: "5" },
        feetInchesToCm,
      ),
    ).toBeNull();
  });

  it("returns null for blank / non-positive metric height", () => {
    expect(
      parseHeightInputToCm({ measurementSystem: "metric", cm: "" }, feetInchesToCm),
    ).toBeNull();
    expect(
      parseHeightInputToCm({ measurementSystem: "metric", cm: "0" }, feetInchesToCm),
    ).toBeNull();
  });
});

describe("goalEditorPace — profile row parsing", () => {
  it("parses a full row into the normalised editor shape", () => {
    const p = parseGoalEditorProfileRow({
      sex: "female",
      age: 30,
      weight_kg: 60,
      height_cm: 165,
      activity_level: "moderate",
      goal: "cut",
      plan_pace: "accelerated",
      pace_kg_per_week: 0.72,
      goal_weight_kg: 55,
      nutrition_strategy: "high_protein",
      measurement_system: "imperial",
      adaptive_tdee: 1850,
      adaptive_tdee_confidence: "high",
      adaptive_tdee_updated_at: "2026-05-25T00:00:00.000Z",
    });
    expect(p).toEqual({
      sex: "female",
      age: 30,
      weightKg: 60,
      heightCm: 165,
      activityLevel: "moderate",
      goal: "cut",
      planPace: "accelerated",
      paceKgPerWeek: 0.72,
      goalWeightKg: 55,
      nutritionStrategy: "high_protein",
      measurementSystem: "imperial",
      adaptiveTdee: 1850,
      adaptiveTdeeConfidence: "high",
      adaptiveTdeeUpdatedAt: "2026-05-25T00:00:00.000Z",
      targetFiberG: null,
      targetFiberSource: null,
    });
  });

  it("defends a partial / legacy row with safe defaults", () => {
    const p = parseGoalEditorProfileRow({ goal: "lose" });
    expect(p.goal).toBe("cut");
    expect(p.planPace).toBe("steady");
    expect(p.paceKgPerWeek).toBeNull();
    expect(p.measurementSystem).toBe("metric");
    expect(p.adaptiveTdee).toBeNull();
    expect(p.weightKg).toBeNull();
  });

  it("tolerates null / undefined data", () => {
    expect(parseGoalEditorProfileRow(null).goal).toBe("cut");
    expect(parseGoalEditorProfileRow(undefined).sex).toBe("unspecified");
  });
});

// ─── ENG-1027: below-safety-floor acknowledge-to-proceed gate ───────────
//
// The shared gate + copy back the acknowledge step on BOTH editor UIs
// (web dialog + mobile sheet), so pinning them here proves web == mobile
// for the gate logic and the exact words shown, without rendering either.
describe("canSaveBelowFloor (ENG-1027)", () => {
  it("always allows saving when the target is at or above the floor", () => {
    expect(
      canSaveBelowFloor({ belowSafetyFloor: false, acknowledged: false }),
    ).toBe(true);
    // Above floor, acknowledgment is irrelevant.
    expect(
      canSaveBelowFloor({ belowSafetyFloor: false, acknowledged: true }),
    ).toBe(true);
  });

  it("blocks saving below the floor until the user acknowledges", () => {
    expect(
      canSaveBelowFloor({ belowSafetyFloor: true, acknowledged: false }),
    ).toBe(false);
    expect(
      canSaveBelowFloor({ belowSafetyFloor: true, acknowledged: true }),
    ).toBe(true);
  });
});

describe("goalEditorPace — fibre input (ENG-846)", () => {
  it("parseFiberInputToG accepts positive whole grams and rejects blank/invalid", () => {
    expect(parseFiberInputToG("")).toBeNull();
    expect(parseFiberInputToG("  ")).toBeNull();
    expect(parseFiberInputToG("abc")).toBeNull();
    expect(parseFiberInputToG("0")).toBeNull();
    expect(parseFiberInputToG("30")).toBe(30);
    expect(parseFiberInputToG("30.6")).toBe(31);
  });

  it("fiberGoalChanged ignores blank edits and detects real changes", () => {
    expect(fiberGoalChanged(30, null)).toBe(false);
    expect(fiberGoalChanged(30, 30)).toBe(false);
    expect(fiberGoalChanged(30, 35)).toBe(true);
    expect(fiberGoalChanged(null, 25)).toBe(true);
  });

  it("parseGoalEditorProfileRow loads target_fiber_g + source", () => {
    const p = parseGoalEditorProfileRow({
      sex: "female",
      activity_level: "moderate",
      goal: "cut",
      plan_pace: "steady",
      target_fiber_g: 28,
      target_fiber_source: "user",
    });
    expect(p.targetFiberG).toBe(28);
    expect(p.targetFiberSource).toBe("user");
  });
});

describe("safety acknowledge copy (ENG-1027)", () => {
  it("names the exact floor value and stays body-neutral / non-shaming", () => {
    const body = safetyAckBody(1500);
    expect(body).toContain("1,500 kcal");
    // Names the sources explicitly (no vague "health authorities").
    expect(body).toContain("NHS and NIH");
    // Gives the user agency — "You can still set it" (no hard block).
    expect(body).toContain("You can still set it");
    // Carries the legal carve-outs surfaced in the onboarding danger banner.
    expect(body).toContain("clinician");
    expect(body).toContain("pregnant");
    // No shaming / performance language.
    expect(body).not.toMatch(/should not|must not|bad|fail|cheat/i);
  });

  it("interpolates the female floor too", () => {
    expect(safetyAckBody(1200)).toContain("1,200 kcal");
  });

  it("exposes a stable title + confirm label for both platforms", () => {
    expect(SAFETY_ACK_TITLE).toBe("Confirm a target below the safety floor");
    expect(SAFETY_ACK_CONFIRM_LABEL).toBe(
      "I understand this is below the recommended minimum",
    );
  });
});
