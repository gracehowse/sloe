import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TodayWeekView, type TodayWeekDay } from "../../src/app/components/suppr/today-week-view";

void React;

/**
 * TodayWeekView (web) — chart upgrade pin (ui-critic finding #5,
 * 2026-05-01).
 *
 * Mirrors `apps/mobile/tests/unit/todayWeekChartUpgrade.test.tsx`.
 */

function buildDay(
  i: number,
  short: string,
  calories: number,
  steps: number | null = null,
  waterMl = 0,
): TodayWeekDay {
  return {
    key: `2026-05-${String(i + 1).padStart(2, "0")}`,
    short,
    date: new Date(2026, 4, i + 1),
    totals: { calories, protein: 0, carbs: 0, fat: 0 },
    waterMl,
    steps,
  };
}

const SEVEN_DAYS: TodayWeekDay[] = [
  buildDay(0, "Mon", 1800),
  buildDay(1, "Tue", 2100),
  buildDay(2, "Wed", 1950),
  buildDay(3, "Thu", 2400),
  buildDay(4, "Fri", 1990), // closest to 2000-target (delta 10)
  buildDay(5, "Sat", 1500),
  buildDay(6, "Sun", 0), // unlogged → excluded
];
const SEVEN_GOALS = [2000, 2000, 2000, 2000, 2000, 2000, 2000];

const baseProps = (override: Partial<React.ComponentProps<typeof TodayWeekView>> = {}) => ({
  days: SEVEN_DAYS,
  weekTotals: { calories: 11740, protein: 0, carbs: 0, fat: 0 },
  weekAvg: { calories: 1677, protein: 0, carbs: 0, fat: 0 },
  loggedDaysInWeek: 6,
  weekEffectiveCalorieBudget: 14000,
  calorieTarget: 2000,
  proteinTarget: 100,
  carbsTarget: 200,
  fatTarget: 60,
  waterMlTarget: 2000,
  dailyStepsGoal: 10000,
  preferActivityAdjustedCalories: false,
  maintenanceForWeek: 2200,
  dayGoals: SEVEN_GOALS,
  onSelectDayKey: vi.fn(),
  ...override,
});

describe("TodayWeekView (web) — chart upgrade", () => {
  it("renders all 7 bars with stable testIDs", () => {
    render(<TodayWeekView {...baseProps()} />);
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`today-week-chart-bar-${i}`)).toBeDefined();
    }
  });

  it("renders the target rule when calorieTarget < maxCal", () => {
    render(<TodayWeekView {...baseProps()} />);
    expect(screen.getByTestId("today-week-chart-target-rule")).toBeDefined();
  });

  it("hides the target rule when there is no valid target", () => {
    render(<TodayWeekView {...baseProps({ calorieTarget: 0, dayGoals: [0, 0, 0, 0, 0, 0, 0] })} />);
    expect(screen.queryByTestId("today-week-chart-target-rule")).toBeNull();
  });

  it("above-chart summary surfaces 7-day avg + closest-to-target day", () => {
    render(<TodayWeekView {...baseProps()} />);
    const summary = screen.getByTestId("today-week-chart-summary");
    expect(summary.textContent).toContain("7-day avg: 1677 kcal");
    expect(summary.textContent).toContain("closest to target: Fri");
  });

  it("hides the summary line when no day has logged food", () => {
    render(
      <TodayWeekView
        {...baseProps({
          days: SEVEN_DAYS.map((d) => ({ ...d, totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } })),
          loggedDaysInWeek: 0,
        })}
      />,
    );
    expect(screen.queryByTestId("today-week-chart-summary")).toBeNull();
  });

  it("clicking a bar surfaces the floating tooltip with day name + kcal + target + delta", () => {
    render(<TodayWeekView {...baseProps()} />);
    fireEvent.click(screen.getByTestId("today-week-chart-bar-3")); // Thu 2400 / 2000
    const tooltip = screen.getByTestId("today-week-chart-tooltip");
    expect(tooltip.textContent).toContain("Thu");
    expect(tooltip.textContent).toContain("2400 / 2000 kcal");
    expect(tooltip.textContent).toContain("400 kcal over");
  });

  it("clicking the same bar twice dismisses the tooltip", () => {
    render(<TodayWeekView {...baseProps()} />);
    fireEvent.click(screen.getByTestId("today-week-chart-bar-3"));
    expect(screen.getByTestId("today-week-chart-tooltip")).toBeDefined();
    fireEvent.click(screen.getByTestId("today-week-chart-bar-3"));
    expect(screen.queryByTestId("today-week-chart-tooltip")).toBeNull();
  });

  it("does not render a tooltip when no bar has been clicked", () => {
    render(<TodayWeekView {...baseProps()} />);
    expect(screen.queryByTestId("today-week-chart-tooltip")).toBeNull();
  });
});
