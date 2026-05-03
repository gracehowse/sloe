/**
 * TodayDashboardMacroTiles — "View all N nutrients" pill (2026-05-02
 * revert of PR #30).
 *
 * Pinned behaviour:
 *   - When `nutrientRows` is non-empty AND `onPressViewAllNutrients`
 *     is provided, the pill renders below the inline rows with the
 *     count-aware label "View all {count} nutrients".
 *   - Clicking the pill invokes the callback (which the host wires to
 *     open `FullNutrientPanelSheet`).
 *   - When `onPressViewAllNutrients` is omitted, the pill is absent
 *     (e.g. surfaces that don't ship the rich panel sheet).
 *   - When `nutrientRows` is empty, the entire Nutrients block is
 *     hidden including the pill.
 *
 * Mobile parity: the equivalent entry point on mobile is the
 * "Nutrients" link inside `TodayDashboardMacroTiles.tsx` (mobile)
 * which opens the same `FullNutrientPanelSheet`.
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import { TodayDashboardMacroTiles } from "../../src/app/components/suppr/today-dashboard-macro-tiles";

const baseProps = {
  trackedMacros: ["protein", "carbs", "fat"],
  proteinCurrent: 80,
  proteinTarget: 150,
  carbsCurrent: 200,
  carbsTarget: 300,
  fatCurrent: 50,
  fatTarget: 80,
  fiberCurrent: 12,
  fiberTarget: 28,
  sugarG: 18,
  sodiumMg: 1100,
  waterCurrentMl: 1000,
  waterTargetMl: 2500,
  formatWaterLine: (ml: number) => `${(ml / 1000).toFixed(1)} L`,
  onAddWaterMl: () => {},
};

describe("TodayDashboardMacroTiles — View all nutrients pill", () => {
  it("renders the count-aware pill when both nutrientRows + callback + count are provided", () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        nutrientRows={[
          { key: "satFat_day", label: "Sat fat", value: "12g" },
          { key: "iron_day", label: "Iron", value: "8mg" },
        ]}
        onPressViewAllNutrients={onPress}
        viewAllNutrientsCount={34}
      />,
    );
    const cta = getByTestId("today-view-all-nutrients-cta");
    expect(cta.textContent).toMatch(/View all 34 nutrients/);
  });

  it("invokes the callback on click", () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        nutrientRows={[
          { key: "satFat_day", label: "Sat fat", value: "12g" },
        ]}
        onPressViewAllNutrients={onPress}
        viewAllNutrientsCount={34}
      />,
    );
    fireEvent.click(getByTestId("today-view-all-nutrients-cta"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("falls back to the generic label when count is omitted", () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        nutrientRows={[
          { key: "satFat_day", label: "Sat fat", value: "12g" },
        ]}
        onPressViewAllNutrients={onPress}
      />,
    );
    const cta = getByTestId("today-view-all-nutrients-cta");
    expect(cta.textContent).toMatch(/^View all nutrients/);
  });

  it("omits the pill when no callback is provided", () => {
    const { queryByTestId } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        nutrientRows={[
          { key: "satFat_day", label: "Sat fat", value: "12g" },
        ]}
      />,
    );
    expect(queryByTestId("today-view-all-nutrients-cta")).toBeNull();
  });

  it("omits the entire Nutrients block (and thus the pill) when nutrientRows is empty", () => {
    const onPress = vi.fn();
    const { queryByTestId, container } = render(
      <TodayDashboardMacroTiles
        {...baseProps}
        nutrientRows={[]}
        onPressViewAllNutrients={onPress}
        viewAllNutrientsCount={34}
      />,
    );
    expect(queryByTestId("today-view-all-nutrients-cta")).toBeNull();
    expect(container.textContent ?? "").not.toMatch(/Nutrients/);
  });
});
