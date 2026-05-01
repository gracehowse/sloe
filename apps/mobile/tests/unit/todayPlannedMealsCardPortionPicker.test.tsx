// @vitest-environment jsdom
/**
 * TodayPlannedMealsCard — portion picker wiring (audit 2026-04-30).
 *
 * The previous implementation called the system `Alert.alert` to pick
 * portion. After the customer-lens audit we route through the in-app
 * `PortionPickerSheet`. These tests pin the wiring contract:
 *   1. Tapping "Log today" opens the sheet and surfaces the meal name.
 *   2. Picking a portion fires `onLogPlannedMealWithPortion` with that
 *      exact meal entry + portion value.
 *   3. Cancelling the sheet does not call the log callback.
 *   4. There is NO `Alert.alert` invocation on tap — we never fall
 *      back to the system alert (regression guard).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import { TodayPlannedMealsCard } from "../../components/today/TodayPlannedMealsCard";

void React;

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#0f172a",
    textSecondary: "#475569",
    textTertiary: "#94a3b8",
    card: "#ffffff",
    cardBorder: "#e4e4ec",
    background: "#fafafa",
  }),
}));

const STYLES = {
  card: {},
  mealSlotHeader: {},
  mealSlotName: {},
  mealRow: {},
  mealName: {},
  mealMeta: {},
};

const PLANNED = [
  {
    name: "Yoghurt bowl",
    recipe_title: "Greek yoghurt bowl",
    calories: 320,
    protein: 22,
    carbs: 30,
    fat: 9,
    recipe_id: null,
  },
];

describe("TodayPlannedMealsCard — portion picker wiring", () => {
  it("opens the in-app sheet (no system Alert) when 'Log today' is tapped", async () => {
    const RN = await import("react-native");
    const alertSpy = vi.spyOn(RN.Alert, "alert").mockImplementation(() => undefined);

    const { getByLabelText, getByText } = render(
      <TodayPlannedMealsCard
        plannedMeals={PLANNED}
        onLogPlannedMealWithPortion={() => undefined}
        styles={STYLES}
      />,
    );

    fireEvent.press(getByLabelText("Log Greek yoghurt bowl today"));
    // The sheet header references the meal name.
    expect(getByText("Log Greek yoghurt bowl")).toBeTruthy();
    expect(getByText("How much did you eat?")).toBeTruthy();
    // Regression guard — system alert must NOT be used.
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it("fires onLogPlannedMealWithPortion(meal, 1.5) when 1½× is picked", () => {
    const onLog = vi.fn();
    const { getByLabelText } = render(
      <TodayPlannedMealsCard
        plannedMeals={PLANNED}
        onLogPlannedMealWithPortion={onLog}
        styles={STYLES}
      />,
    );

    fireEvent.press(getByLabelText("Log Greek yoghurt bowl today"));
    fireEvent.press(getByLabelText("1½ × portion"));

    expect(onLog).toHaveBeenCalledTimes(1);
    expect(onLog).toHaveBeenCalledWith(PLANNED[0], 1.5);
  });

  it("does not call the log callback when the user cancels", () => {
    const onLog = vi.fn();
    const { getByLabelText } = render(
      <TodayPlannedMealsCard
        plannedMeals={PLANNED}
        onLogPlannedMealWithPortion={onLog}
        styles={STYLES}
      />,
    );

    fireEvent.press(getByLabelText("Log Greek yoghurt bowl today"));
    fireEvent.press(getByLabelText("Cancel"));

    expect(onLog).not.toHaveBeenCalled();
  });

  it("falls back to `name` when `recipe_title` is absent", () => {
    const onLog = vi.fn();
    const meal = {
      name: "Quick oats",
      calories: 250,
      protein: 8,
      carbs: 40,
      fat: 5,
    };
    const { getByLabelText, getByText } = render(
      <TodayPlannedMealsCard
        plannedMeals={[meal]}
        onLogPlannedMealWithPortion={onLog}
        styles={STYLES}
      />,
    );

    fireEvent.press(getByLabelText("Log Quick oats today"));
    expect(getByText("Log Quick oats")).toBeTruthy();
    fireEvent.press(getByLabelText("1 × portion"));
    expect(onLog).toHaveBeenCalledWith(meal, 1);
  });
});
