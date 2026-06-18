/**
 * ENG-1100 — pins shared EmptyMealSlotRow exports consumed by Today + Plan (mobile).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ENG-1100 wiring — mobile Today + Plan import EmptyMealSlotAimLine", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

  it("TodayMealsSection uses EmptyMealSlotAimLine", () => {
    const src = read("components/today/TodayMealsSection.tsx");
    expect(src).toMatch(/EmptyMealSlotAimLine/);
    expect(src).toMatch(/emptySlotAimKcal/);
  });

  it("planner uses EmptyMealSlotAimLine for empty + placeholder aim rows", () => {
    const src = read("app/(tabs)/planner.tsx");
    expect(src).toMatch(/EmptyMealSlotAimLine/);
    expect(read("components/EmptyMealSlotRow.tsx")).toMatch(/plan-slot-aim-/);
  });

  it("exports EmptyMealSlotAimLine from the shared mobile module", () => {
    expect(read("components/EmptyMealSlotRow.tsx")).toMatch(/export function EmptyMealSlotAimLine/);
  });
});
