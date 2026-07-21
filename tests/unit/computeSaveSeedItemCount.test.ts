/**
 * ENG-1586 — pins `computeSaveSeedItemCount`, the `saveSeedItemCount`
 * input Cascade Rule 1 (`re_log_prompt`) needs: "the size of the
 * would-be saved-meal seed when the user accepts the prompt" (see
 * `weeklyDigestSuggestion.ts`'s doc comment). Concretely: the item
 * count of the most recent day (within the primary window, falling
 * back to the extended window) that has entries logged under the
 * suggested slot.
 */
import { describe, expect, it } from "vitest";
import { computeSaveSeedItemCount } from "../../src/lib/nutrition/weeklyRecap";

const weekKeys = [
  "2026-04-13",
  "2026-04-14",
  "2026-04-15",
  "2026-04-16",
  "2026-04-17",
  "2026-04-18",
  "2026-04-19",
];

const extendedWeekKeys = [
  "2026-04-06",
  "2026-04-07",
  "2026-04-08",
  "2026-04-09",
  "2026-04-10",
  "2026-04-11",
  "2026-04-12",
  ...weekKeys,
];

function meal(slot: string, recipeTitle: string, calories = 450) {
  return { name: slot, recipeTitle, calories, protein: 30, carbs: 40, fat: 15 };
}

describe("computeSaveSeedItemCount", () => {
  it("counts the items logged under the slot on the most recent matching day in weekKeys", () => {
    const byDay: Record<string, ReturnType<typeof meal>[]> = {
      "2026-04-13": [meal("Breakfast", "Oats")],
      "2026-04-16": [meal("Breakfast", "Eggs"), meal("Breakfast", "Toast")],
      "2026-04-19": [meal("Breakfast", "Eggs"), meal("Breakfast", "Toast"), meal("Breakfast", "Juice")],
    };
    expect(computeSaveSeedItemCount(byDay, "Breakfast", weekKeys)).toBe(3);
  });

  it("ignores other slots on the most recent day", () => {
    const byDay: Record<string, ReturnType<typeof meal>[]> = {
      "2026-04-19": [meal("Lunch", "Salad"), meal("Lunch", "Coffee")],
      "2026-04-18": [meal("Breakfast", "Oats"), meal("Breakfast", "Berries")],
    };
    expect(computeSaveSeedItemCount(byDay, "Breakfast", weekKeys)).toBe(2);
  });

  it("falls back to the extended window when the slot never appears in weekKeys", () => {
    const byDay: Record<string, ReturnType<typeof meal>[]> = {
      // Only in the extended (pre-week) range.
      "2026-04-08": [meal("Dinner", "Stir fry"), meal("Dinner", "Rice")],
      "2026-04-12": [meal("Dinner", "Stir fry")],
    };
    expect(computeSaveSeedItemCount(byDay, "Dinner", weekKeys)).toBe(0);
    expect(computeSaveSeedItemCount(byDay, "Dinner", weekKeys, extendedWeekKeys)).toBe(1);
  });

  it("returns 0 when the slot appears in neither window", () => {
    const byDay: Record<string, ReturnType<typeof meal>[]> = {
      "2026-04-19": [meal("Lunch", "Salad")],
    };
    expect(computeSaveSeedItemCount(byDay, "Snacks", weekKeys, extendedWeekKeys)).toBe(0);
  });

  it("treats legacy 'Snack' rows as 'Snacks' (matches the loosened-gate normalisation)", () => {
    const byDay: Record<string, ReturnType<typeof meal>[]> = {
      "2026-04-19": [meal("Snack", "Protein bar"), meal("Snack", "Nuts")],
    };
    expect(computeSaveSeedItemCount(byDay, "Snacks", weekKeys)).toBe(2);
  });

  it("does not double-search days present in both weekKeys and extendedWeekKeys", () => {
    // extendedWeekKeys is a superset of weekKeys; a day within weekKeys
    // with 0 matching items should not be re-visited via the extended
    // fallback pass — the earlier (pre-week) day's count should win.
    const byDay: Record<string, ReturnType<typeof meal>[]> = {
      "2026-04-19": [meal("Lunch", "Salad")], // in weekKeys, no Dinner rows
      "2026-04-08": [meal("Dinner", "Stir fry")], // pre-week only
    };
    expect(computeSaveSeedItemCount(byDay, "Dinner", weekKeys, extendedWeekKeys)).toBe(1);
  });
});
