import { describe, expect, it } from "vitest";
import { isProfileRowComplete, type ProfileGateRow } from "../../src/lib/client/homeProfileGate.ts";

function row(p: Partial<NonNullable<ProfileGateRow>>): ProfileGateRow {
  return {
    onboarding_completed: null,
    target_calories: null,
    target_protein: null,
    target_carbs: null,
    target_fat: null,
    age: null,
    height_cm: null,
    weight_kg: null,
    sex: null,
    activity_level: null,
    goal: null,
    ...p,
  };
}

describe("isProfileRowComplete", () => {
  it("returns true when onboarding_completed is true even if targets are missing", () => {
    expect(
      isProfileRowComplete(
        row({
          onboarding_completed: true,
          target_calories: null,
          target_protein: null,
        }),
      ),
    ).toBe(true);
  });

  it("returns false when onboarding_completed is false and fields are incomplete", () => {
    expect(
      isProfileRowComplete(
        row({
          onboarding_completed: false,
          target_calories: 2000,
          target_protein: 150,
          target_carbs: 200,
          target_fat: 60,
          age: 30,
          height_cm: 170,
          weight_kg: 70,
          sex: "female",
          activity_level: "moderate",
          goal: null,
        }),
      ),
    ).toBe(false);
  });

  it("legacy path: all required fields present without onboarding_completed", () => {
    expect(
      isProfileRowComplete(
        row({
          onboarding_completed: null,
          target_calories: 2000,
          target_protein: 150,
          target_carbs: 200,
          target_fat: 60,
          age: 30,
          height_cm: 170,
          weight_kg: 70,
          sex: "female",
          activity_level: "moderate",
          goal: "maintain",
        }),
      ),
    ).toBe(true);
  });

  it("returns false for null profile", () => {
    expect(isProfileRowComplete(null)).toBe(false);
  });
});
