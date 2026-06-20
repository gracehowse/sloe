import { describe, expect, it } from "vitest";
import {
  isLearnedCustomFood,
  isLearnedCustomFoodSource,
  LEARNED_CUSTOM_FOOD_REUSE_CUE,
  type CustomFood,
} from "@/lib/nutrition/customFoods";

const baseFood = (): CustomFood => ({
  id: "cf-1",
  userId: "u1",
  name: "Salmon",
  baseGrams: 100,
  calories: 200,
  protein: 25,
  carbs: 0,
  fat: 10,
  servings: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("learned custom food helpers (ENG-976)", () => {
  it("exports the reuse cue copy", () => {
    expect(LEARNED_CUSTOM_FOOD_REUSE_CUE).toBe("Using your numbers for this one");
  });

  it("treats photo_correction and voice_correction as learned sources", () => {
    expect(isLearnedCustomFoodSource("photo_correction")).toBe(true);
    expect(isLearnedCustomFoodSource("voice_correction")).toBe(true);
  });

  it("does not treat manual or missing source as learned", () => {
    expect(isLearnedCustomFoodSource("manual")).toBe(false);
    expect(isLearnedCustomFoodSource(undefined)).toBe(false);
  });

  it("isLearnedCustomFood mirrors source on a row", () => {
    expect(isLearnedCustomFood({ ...baseFood(), source: "photo_correction" })).toBe(true);
    expect(isLearnedCustomFood({ ...baseFood(), source: "manual" })).toBe(false);
  });
});
