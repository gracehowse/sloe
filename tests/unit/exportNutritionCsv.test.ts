import { describe, it, expect } from "vitest";
import { buildNutritionCsvForDay } from "@/lib/nutrition/exportNutritionCsv";
import type { LoggedMeal } from "@/types/recipe";

describe("buildNutritionCsvForDay", () => {
  const meal: LoggedMeal = {
    id: "m1",
    name: "Lunch",
    recipeTitle: "Chicken Salad",
    time: "Lunch",
    calories: 450,
    protein: 35,
    carbs: 20,
    fat: 18,
    fiberG: 5,
    waterMl: 200,
  };

  it("includes header row", () => {
    const csv = buildNutritionCsvForDay("2026-04-13", [meal], 0);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("date,time,meal_slot,name,calories,protein_g,carbs_g,fat_g,fiber_g,water_ml");
  });

  it("maps meal fields to correct columns", () => {
    const csv = buildNutritionCsvForDay("2026-04-13", [meal], 0);
    const lines = csv.split("\n");
    const cols = lines[1]!.split(",");
    expect(cols[0]).toBe("2026-04-13");
    expect(cols[1]).toBe("Lunch");         // m.time
    expect(cols[2]).toBe("Lunch");         // m.name (meal_slot)
    expect(cols[3]).toBe("Chicken Salad"); // m.recipeTitle
    expect(cols[4]).toBe("450");
    expect(cols[5]).toBe("35");
    expect(cols[6]).toBe("20");
    expect(cols[7]).toBe("18");
    expect(cols[8]).toBe("5");
    expect(cols[9]).toBe("200");
  });

  it("appends extra water row when > 0", () => {
    const csv = buildNutritionCsvForDay("2026-04-13", [meal], 500);
    const lines = csv.split("\n");
    expect(lines.length).toBe(3); // header + meal + water
    expect(lines[2]).toContain("Quick water");
    expect(lines[2]).toContain("500");
  });

  it("omits extra water row when 0", () => {
    const csv = buildNutritionCsvForDay("2026-04-13", [meal], 0);
    const lines = csv.split("\n");
    expect(lines.length).toBe(2); // header + meal only
  });

  it("escapes commas and quotes in recipe titles", () => {
    const specialMeal: LoggedMeal = {
      ...meal,
      recipeTitle: 'Mac "n" Cheese, Extra',
    };
    const csv = buildNutritionCsvForDay("2026-04-13", [specialMeal], 0);
    expect(csv).toContain('"Mac ""n"" Cheese, Extra"');
  });

  it("handles missing fiberG and waterMl gracefully", () => {
    const spareMeal: LoggedMeal = { ...meal, fiberG: undefined, waterMl: undefined };
    const csv = buildNutritionCsvForDay("2026-04-13", [spareMeal], 0);
    const lines = csv.split("\n");
    const cols = lines[1]!.split(",");
    expect(cols[8]).toBe("");  // fiberG missing → empty
    expect(cols[9]).toBe("");  // waterMl missing → empty
  });
});
