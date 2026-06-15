import { describe, expect, it } from "vitest";

import {
  DEFAULT_USER_MEAL_SLOT_CONFIG,
  enabledMealSlotLabels,
  mealSectionSortOrder,
  parseUserMealSlotConfig,
  slotCountForPreset,
} from "../../src/lib/nutrition/userMealSlotConfig";

describe("userMealSlotConfig (ENG-1177)", () => {
  it("defaults to classic four slots", () => {
    expect(enabledMealSlotLabels(null)).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
      "Snacks",
    ]);
  });

  it("parses four_meals preset", () => {
    const cfg = parseUserMealSlotConfig({ preset: "four_meals" });
    expect(cfg.preset).toBe("four_meals");
    expect(enabledMealSlotLabels(cfg)).toEqual(["Meal 1", "Meal 2", "Meal 3", "Meal 4"]);
  });

  it("parses six_meals preset", () => {
    expect(slotCountForPreset("six_meals")).toBe(6);
    expect(enabledMealSlotLabels({ preset: "six_meals" }).length).toBe(6);
  });

  it("rejects malformed labels array", () => {
    const cfg = parseUserMealSlotConfig({
      preset: "four_meals",
      labels: ["Meal 1", "Meal 2"],
    });
    expect(cfg.labels).toBeUndefined();
  });

  it("mealSectionSortOrder appends Planned", () => {
    expect(mealSectionSortOrder(DEFAULT_USER_MEAL_SLOT_CONFIG).at(-1)).toBe("Planned");
  });
});
