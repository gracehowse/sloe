import { describe, expect, it } from "vitest";

import { buildEditedLoggedMeal } from "@/app/components/suppr/edit-meal-dialog";
import type { LoggedMeal } from "@/types/recipe";

const baseMeal: LoggedMeal = {
  id: "m1",
  name: "Lunch",
  recipeTitle: "Salad",
  time: "12:00 PM",
  calories: 400,
  protein: 20,
  carbs: 30,
  fat: 15,
  fiberG: 8,
  micros: { sugarG: 10 },
  portionMultiplier: 2,
};

describe("buildEditedLoggedMeal", () => {
  it("scales fibre and micros when portion changes", () => {
    const updated = buildEditedLoggedMeal({
      original: baseMeal,
      anchorDayKey: "2026-06-14",
      slot: "Lunch",
      title: "Salad",
      calories: 200,
      protein: 10,
      carbs: 15,
      fat: 7.5,
      portionMultiplier: 1,
    });
    expect(updated.portionMultiplier).toBe(1);
    expect(updated.fiberG).toBe(4);
    expect(updated.micros?.sugarG).toBe(5);
  });

  it("leaves fibre and micros unchanged when portion is unchanged", () => {
    const updated = buildEditedLoggedMeal({
      original: baseMeal,
      anchorDayKey: "2026-06-14",
      slot: "Dinner",
      title: "Renamed",
      calories: 500,
      protein: 25,
      carbs: 35,
      fat: 18,
      portionMultiplier: 2,
    });
    expect(updated.name).toBe("Dinner");
    expect(updated.recipeTitle).toBe("Renamed");
    expect(updated.fiberG).toBe(8);
    expect(updated.micros?.sugarG).toBe(10);
  });
});
