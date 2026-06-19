/**
 * ENG-1100 — pins shared EmptyMealSlotRow exports consumed by Today + Plan.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { Coffee } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  EmptyMealSlotAimLine,
  PlanAbsentMealSlotRow,
} from "../../src/app/components/suppr/empty-meal-slot-row";

describe("EmptyMealSlotAimLine", () => {
  it("renders Today aim copy with the stable test ID", () => {
    render(<EmptyMealSlotAimLine slot="Breakfast" aimKcal={310} surface="today" />);
    const line = screen.getByTestId("today-slot-aim-Breakfast");
    expect(line).toHaveTextContent("Aim ~310 kcal");
  });

  it("renders Plan aim copy with the stable test ID", () => {
    render(<EmptyMealSlotAimLine slot="breakfast" aimKcal={310} surface="plan" />);
    const line = screen.getByTestId("plan-slot-aim-breakfast");
    expect(line).toHaveTextContent("Aim ~310 kcal");
  });
});

describe("PlanAbsentMealSlotRow", () => {
  it("shows the aim line when a target exists", () => {
    render(<PlanAbsentMealSlotRow slot="breakfast" SlotIcon={Coffee} aimKcal={310} />);
    expect(screen.getByTestId("plan-slot-aim-breakfast")).toHaveTextContent("Aim ~310 kcal");
    expect(screen.getByText("breakfast")).toBeInTheDocument();
  });

  it("falls back to legacy copy when there is no aim", () => {
    render(<PlanAbsentMealSlotRow slot="snacks" SlotIcon={Coffee} aimKcal={null} />);
    expect(screen.queryByTestId("plan-slot-aim-snacks")).not.toBeInTheDocument();
    expect(screen.getByText("Empty slot")).toBeInTheDocument();
  });
});

describe("ENG-1100 wiring — Today + Plan import the shared row module", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

  it("today-meals-section uses EmptyMealSlotAimLine", () => {
    const src = read("src/app/components/suppr/today-meals-section.tsx");
    expect(src).toMatch(/from "\.\/empty-meal-slot-row"/);
    expect(src).toMatch(/EmptyMealSlotAimLine/);
  });

  it("MealPlanner uses PlanAbsentMealSlotRow + EmptyMealSlotAimLine", () => {
    const src = read("src/app/components/MealPlanner.tsx");
    expect(src).toMatch(/empty-meal-slot-row/);
    expect(src).toMatch(/PlanAbsentMealSlotRow/);
    expect(src).toMatch(/EmptyMealSlotAimLine/);
  });
});
