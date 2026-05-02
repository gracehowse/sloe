// @vitest-environment jsdom
/**
 * TodayWeekView (mobile) — chart upgrade pin (ui-critic finding #5,
 * 2026-05-01).
 *
 * Behaviour pinned here:
 *   - 7 bars render with stable testIDs (`today-week-chart-bar-{0..6}`).
 *   - Target rule renders when calorieTarget falls inside the visible
 *     plot range; hidden when target > maxCal.
 *   - Above-chart summary line surfaces "7-day avg" and
 *     "closest to target: <day>".
 *   - Tapping a bar opens the floating scrubber tooltip with the
 *     day's kcal logged / target / delta.
 *   - Tapping the same bar again dismisses the tooltip.
 *   - Tooltip is hidden when no bar is selected.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import {
  TodayWeekView,
  type TodayWeekDay,
} from "../../components/today/TodayWeekView";

// useReduceMotion isn't available without a real native env. The
// chart's only Reanimated dependency is `react-native-reanimated`,
// which the project's mobile vitest setup already shims. The test
// stubs the hook so animations resolve in a single tick.
vi.mock("@/hooks/use-reduce-motion", () => ({
  useReduceMotion: () => true,
}));

void React;

function buildDay(
  i: number,
  short: string,
  calories: number,
  protein = 0,
  carbs = 0,
  fat = 0,
): TodayWeekDay {
  return {
    key: `2026-05-${String(i + 1).padStart(2, "0")}`,
    short,
    date: new Date(2026, 4, i + 1),
    totals: { calories, protein, carbs, fat },
  };
}

const SEVEN_DAYS: TodayWeekDay[] = [
  buildDay(0, "Mon", 1800),
  buildDay(1, "Tue", 2100),
  buildDay(2, "Wed", 1950),
  buildDay(3, "Thu", 2400),
  buildDay(4, "Fri", 1990), // closest to 2000-target (delta 10)
  buildDay(5, "Sat", 1500),
  buildDay(6, "Sun", 0), // unlogged — excluded from "best day"
];
const SEVEN_GOALS = [2000, 2000, 2000, 2000, 2000, 2000, 2000];

const renderProps = (overrides?: Partial<React.ComponentProps<typeof TodayWeekView>>) => ({
  days: SEVEN_DAYS,
  weekTotals: { calories: 11740, protein: 0, carbs: 0, fat: 0 },
  weekAvg: { calories: 1677, protein: 0, carbs: 0, fat: 0 },
  daysWithFood: 6,
  weekEffectiveCalorieBudget: 14000,
  calorieTarget: 2000,
  proteinTarget: 100,
  carbsTarget: 200,
  fatTarget: 60,
  preferActivityAdjustedCalories: false,
  activityBonusCaloriesOnly: false,
  maintenanceKcal: 2200,
  dayGoals: SEVEN_GOALS,
  onSelectDay: vi.fn(),
  styles: {
    card: { padding: 12, backgroundColor: "#fff" },
    cardTitle: { fontWeight: "700" },
    macroBarBlock: {},
    macroBarTop: {},
    macroBarTitle: {},
    macroBarNums: {},
    macroBarTrack: {},
    macroBarFill: {},
  } as Record<string, any>,
  textColor: "#000",
  textSecondaryColor: "#555",
  textTertiaryColor: "#888",
  borderColor: "#eee",
  ...overrides,
});

describe("TodayWeekView (mobile) — chart upgrade", () => {
  it("renders all 7 bars with stable testIDs", () => {
    const { getByTestId } = render(<TodayWeekView {...renderProps()} />);
    for (let i = 0; i < 7; i++) {
      expect(getByTestId(`today-week-chart-bar-${i}`)).toBeTruthy();
    }
  });

  it("renders the target rule when calorieTarget < maxCal", () => {
    // maxCal = max(2400, 2000) = 2400 → target 2000 fits in plot.
    const { getByTestId } = render(<TodayWeekView {...renderProps()} />);
    expect(getByTestId("today-week-chart-target-rule")).toBeTruthy();
  });

  it("hides the target rule when there is no valid target", () => {
    // target 0 → rule is suppressed (would render at the very bottom
    // and read as the baseline, not a target).
    const { queryByTestId } = render(
      <TodayWeekView
        {...renderProps({
          calorieTarget: 0,
          dayGoals: [0, 0, 0, 0, 0, 0, 0],
        })}
      />,
    );
    expect(queryByTestId("today-week-chart-target-rule")).toBeNull();
  });

  it("above-chart summary surfaces 7-day avg + closest-to-target day", () => {
    const { getByTestId } = render(<TodayWeekView {...renderProps()} />);
    const summary = getByTestId("today-week-chart-summary");
    // Friday is closest (1990 vs 2000 goal → delta 10).
    expect(summary.props.children.toString()).toContain("7-day avg: 1677 kcal");
    expect(summary.props.children.toString()).toContain("closest to target: Fri");
  });

  it("hides the summary line when no day has logged food", () => {
    const { queryByTestId } = render(
      <TodayWeekView
        {...renderProps({
          days: SEVEN_DAYS.map((d) => ({ ...d, totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } })),
          daysWithFood: 0,
        })}
      />,
    );
    expect(queryByTestId("today-week-chart-summary")).toBeNull();
  });

  it("tapping a bar surfaces the floating tooltip with day name + kcal + target + delta", () => {
    const { getByTestId, getByText, getAllByText, getByLabelText } = render(<TodayWeekView {...renderProps()} />);
    fireEvent.press(getByTestId("today-week-chart-bar-3")); // Thu, 2400 vs 2000
    expect(getByTestId("today-week-chart-tooltip")).toBeTruthy();
    // Tooltip carries day name — bar label is also "Thu" so we expect
    // 2 matches once the tooltip is open.
    expect(getAllByText("Thu").length).toBeGreaterThanOrEqual(2);
    // Delta line surfaces "400 kcal over" (signed delta).
    expect(getByText("400 kcal over")).toBeTruthy();
    // Values line shows logged / target.
    expect(getByText("2400 / 2000 kcal")).toBeTruthy();
    // Accessibility label combines day + values + delta for screen readers.
    expect(
      getByLabelText("Thu — 2400 kcal of 2000 kcal target — 400 kcal over"),
    ).toBeTruthy();
  });

  it("tapping the same bar twice dismisses the tooltip", () => {
    const { getByTestId, queryByTestId } = render(<TodayWeekView {...renderProps()} />);
    fireEvent.press(getByTestId("today-week-chart-bar-3"));
    expect(getByTestId("today-week-chart-tooltip")).toBeTruthy();
    fireEvent.press(getByTestId("today-week-chart-bar-3"));
    expect(queryByTestId("today-week-chart-tooltip")).toBeNull();
  });

  it("does not render a tooltip when no bar has been tapped", () => {
    const { queryByTestId } = render(<TodayWeekView {...renderProps()} />);
    expect(queryByTestId("today-week-chart-tooltip")).toBeNull();
  });
});
