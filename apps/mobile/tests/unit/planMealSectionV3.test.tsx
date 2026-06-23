// @vitest-environment jsdom
/**
 * PlanMealSectionV3 (ENG-1225 Block 3) — the v3 Plan meal body. Pins the "All"
 * day-view vs the across-week slot view, the Snack→Snacks slot mapping, and that
 * tapping a filled meal / empty slot fires the right handler with (day, slot).
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textTertiary: "#9B93A3",
    navPrimary: "#3B2A4D",
    backgroundSecondary: "#F5F4F7",
    border: "#E8E2EC",
    borderStrong: "#C9C2D6",
    card: "#FFFFFF",
  }),
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));
vi.mock("@/components/ui/SmartImage", () => ({ SmartImage: () => null }));

import { PlanMealSectionV3 } from "../../components/plan/PlanMealSectionV3";
import type { DayPlan, DayPlanMeal } from "../../lib/types";

const meal = (name: string, calories: number, placeholder = false): DayPlanMeal => ({
  name,
  recipeTitle: name,
  calories,
  protein: 20,
  carbs: 30,
  fat: 10,
  isPlaceholder: placeholder,
});

// Two days; day 0 has B/L/D/Snacks, day 1 has only breakfast filled.
const plan: DayPlan[] = [
  {
    day: 0,
    meals: [
      meal("Oats", 400),
      meal("Salad", 520),
      meal("Roast", 640),
      meal("Yoghurt", 180),
    ],
    totals: { calories: 1740, protein: 90, carbs: 150, fat: 55 },
  },
  {
    day: 1,
    meals: [meal("Toast", 300), meal("", 0, true), meal("", 0, true)],
    totals: { calories: 300, protein: 15, carbs: 40, fat: 8 },
  },
];
const weekDates = [new Date(2026, 5, 15), new Date(2026, 5, 16)];

describe("PlanMealSectionV3", () => {
  it("lists the selected day's four slots under the 'All' filter", () => {
    const { getByLabelText } = render(
      <PlanMealSectionV3
        plan={plan}
        selectedDayIndex={0}
        weekDates={weekDates}
        filter="All"
        onOpenMeal={() => {}}
        onAddToSlot={() => {}}
      />,
    );
    expect(getByLabelText("Breakfast: Oats")).toBeTruthy();
    expect(getByLabelText("Snacks: Yoghurt")).toBeTruthy();
  });

  it("fires onOpenMeal with (dayIndex, slotIndex) when a meal is tapped", () => {
    const onOpenMeal = vi.fn();
    const { getByLabelText } = render(
      <PlanMealSectionV3
        plan={plan}
        selectedDayIndex={0}
        weekDates={weekDates}
        filter="All"
        onOpenMeal={onOpenMeal}
        onAddToSlot={() => {}}
      />,
    );
    fireEvent.press(getByLabelText("Lunch: Salad"));
    expect(onOpenMeal).toHaveBeenCalledWith(0, 1);
  });

  it("maps the Snack filter to the Snacks slot across the week", () => {
    const onAddToSlot = vi.fn();
    const { getByText, getAllByText, getByLabelText } = render(
      <PlanMealSectionV3
        plan={plan}
        selectedDayIndex={0}
        weekDates={weekDates}
        filter="Snack"
        onOpenMeal={() => {}}
        onAddToSlot={onAddToSlot}
      />,
    );
    // Day headers for both days.
    expect(getByText("Monday 15")).toBeTruthy();
    expect(getByText("Tuesday 16")).toBeTruthy();
    // Day 0 snacks filled; day 1 has no snacks slot → "Add snack".
    expect(getByLabelText("Snack: Yoghurt")).toBeTruthy();
    fireEvent.press(getAllByText("Add snack")[0]);
    // Snack → slot index 3.
    expect(onAddToSlot).toHaveBeenCalledWith(1, 3);
  });
});
