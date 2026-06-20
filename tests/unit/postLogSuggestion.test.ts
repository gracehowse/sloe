/**
 * postLogSuggestion — pins the calm post-log "what to eat next"
 * micro-moment (ENG-977).
 *
 * Source: src/lib/nutrition/postLogSuggestion.ts
 *
 * What's pinned:
 *   - Returns null when there's no room left (remaining <= 0) or remaining
 *     is non-finite — the "what to eat next" framing only applies when the
 *     user has budget to spend, otherwise the caller keeps its plain
 *     commit confirmation.
 *   - With budget + an eligible library + a fitting recipe, builds the
 *     suggestion line ("~X kcal left — {slot} could be {recipe}").
 *   - Degrades to the calm remaining-budget line when no recipe is
 *     eligible (library below the north-star threshold).
 *   - Quotes remaining calories rounded to the nearest 10 (the "~"
 *     estimate posture).
 *   - Slot phrasing follows the time of day (breakfast / lunch / dinner /
 *     a snack / your next meal).
 *   - Echoes the committing source and exposes the suggested recipe id /
 *     title for CTA wiring.
 */

import { describe, it, expect } from "vitest";

import {
  buildPostLogSuggestion,
  type NorthStarRecipe,
} from "../../src/lib/nutrition-core";

// 18:30 local → dinner slot (detectSlotForHour 17:30–22:00).
const DINNER = new Date(2026, 5, 20, 18, 30, 0);
// 03:00 local → no slot.
const LATE_NIGHT = new Date(2026, 5, 20, 3, 0, 0);
// 15:00 local → snack slot.
const AFTERNOON = new Date(2026, 5, 20, 15, 0, 0);

const recipes: NorthStarRecipe[] = [
  { id: "r1", title: "Chicken traybake", calories: 620, protein: 48, carbs: 40, fat: 22 },
  { id: "r2", title: "Tofu stir-fry", calories: 540, protein: 30, carbs: 55, fat: 18 },
  { id: "r3", title: "Steak salad", calories: 700, protein: 52, carbs: 18, fat: 40 },
  { id: "r4", title: "Lentil curry", calories: 480, protein: 24, carbs: 62, fat: 12 },
  { id: "r5", title: "Salmon bowl", calories: 580, protein: 40, carbs: 45, fat: 24 },
];

describe("buildPostLogSuggestion (ENG-977 post-log what-to-eat-next)", () => {
  it("returns null when the user is at or over budget (no room to fill)", () => {
    const result = buildPostLogSuggestion({
      library: recipes,
      remaining: { calories: 0, protein: 10, carbs: 10, fat: 5 },
      dailyCalorieTarget: 2000,
      source: "photo",
      now: DINNER,
    });
    expect(result).toBeNull();

    const over = buildPostLogSuggestion({
      library: recipes,
      remaining: { calories: -120, protein: 0, carbs: 0, fat: 0 },
      dailyCalorieTarget: 2000,
      source: "voice",
      now: DINNER,
    });
    expect(over).toBeNull();
  });

  it("returns null when remaining calories are non-finite", () => {
    const result = buildPostLogSuggestion({
      library: recipes,
      remaining: { calories: Number.NaN, protein: 10, carbs: 10, fat: 5 },
      dailyCalorieTarget: 2000,
      source: "photo",
      now: DINNER,
    });
    expect(result).toBeNull();
  });

  it("builds the dinner suggestion line with budget left + an eligible library", () => {
    const result = buildPostLogSuggestion({
      library: recipes,
      remaining: { calories: 640, protein: 45, carbs: 50, fat: 25 },
      dailyCalorieTarget: 2000,
      source: "photo",
      now: DINNER,
    });
    expect(result).not.toBeNull();
    expect(result!.hasSuggestion).toBe(true);
    expect(result!.slot).toBe("dinner");
    expect(result!.remainingCalories).toBe(640);
    expect(result!.recipeId).not.toBeNull();
    expect(result!.recipeTitle).not.toBeNull();
    // "Logged. ~640 kcal left — dinner could be {recipe}."
    expect(result!.line).toContain("~640 kcal left");
    expect(result!.line).toContain("dinner could be ");
    expect(result!.line).toContain(result!.recipeTitle!);
    expect(result!.source).toBe("photo");
  });

  it("degrades to the calm remaining-budget line when the library is too small", () => {
    const result = buildPostLogSuggestion({
      library: [recipes[0]!], // 1 recipe — below the activation threshold (2)
      remaining: { calories: 455, protein: 20, carbs: 20, fat: 10 },
      dailyCalorieTarget: 2000,
      source: "voice",
      now: DINNER,
      userCreatedAt: DINNER, // brand-new account → relaxed threshold = 2
    });
    expect(result).not.toBeNull();
    expect(result!.hasSuggestion).toBe(false);
    expect(result!.recipeId).toBeNull();
    expect(result!.recipeTitle).toBeNull();
    expect(result!.line).toBe("Logged. ~460 kcal left for today.");
  });

  it("rounds remaining calories to the nearest 10 for the estimate posture", () => {
    const result = buildPostLogSuggestion({
      library: [],
      remaining: { calories: 637, protein: 20, carbs: 20, fat: 10 },
      dailyCalorieTarget: 2000,
      source: "photo",
      now: DINNER,
    });
    expect(result!.remainingCalories).toBe(640);
    expect(result!.line).toContain("~640 kcal");
  });

  it("uses 'your next meal' phrasing when no slot is detected", () => {
    const result = buildPostLogSuggestion({
      library: recipes,
      remaining: { calories: 600, protein: 40, carbs: 40, fat: 20 },
      dailyCalorieTarget: 2000,
      source: "photo",
      now: LATE_NIGHT,
    });
    expect(result!.slot).toBeNull();
    expect(result!.line).toContain("your next meal could be ");
  });

  it("uses 'a snack' phrasing in the afternoon snack slot", () => {
    const result = buildPostLogSuggestion({
      library: recipes,
      remaining: { calories: 300, protein: 20, carbs: 30, fat: 8 },
      dailyCalorieTarget: 2000,
      source: "voice",
      now: AFTERNOON,
    });
    expect(result!.slot).toBe("snack");
    expect(result!.line).toContain("a snack could be ");
  });
});
