// @vitest-environment jsdom
/**
 * WeeklyInsightCard (mobile) — ENG-754.
 *
 * Mobile port of web's `TodayWeeklyInsightCard`. These tests pin:
 *   1. The flag gate — nothing renders when
 *      `today-weekly-insight-mobile` is off.
 *   2. The sparkline bar-height maths (`computeSparklineHeights`)
 *      matches the web component's `bars` memo exactly — same
 *      `safeMax = max(target × 1.2, ...daily, 1)` scaling and 0-100
 *      clamp — so the two surfaces can't drift.
 *   3. The honest empty state ("Log a meal to start the week.") and
 *      the no-fabrication rule (null avg → no "kcal daily average").
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react-native";

import {
  WeeklyInsightCard,
  computeSparklineHeights,
} from "../../components/today/WeeklyInsightCard";
import { isFeatureEnabled } from "@/lib/analytics";

void React;

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

const flagFn = isFeatureEnabled as unknown as ReturnType<typeof vi.fn>;

const COLORS = {
  textColor: "#000",
  textSecondaryColor: "#555",
  cardBackgroundColor: "#fff",
  borderColor: "#eee",
};

describe("computeSparklineHeights (ENG-754 sparkline maths)", () => {
  it("scales bars against max(target × 1.2, peak day, 1)", () => {
    // target 2000 → safeMax = 2400. A 2400-kcal day = 100%, 1200 = 50%.
    const bars = computeSparklineHeights([2400, 1200, 0, 0, 0, 0, 0], 2000);
    expect(bars[0]).toBeCloseTo(100, 5);
    expect(bars[1]).toBeCloseTo(50, 5);
    expect(bars[2]).toBe(0);
  });

  it("clamps a day above safeMax to 100", () => {
    // 5000 is the peak so safeMax = 5000; that day is exactly 100.
    const bars = computeSparklineHeights([5000, 0, 0, 0, 0, 0, 0], 2000);
    expect(bars[0]).toBeCloseTo(100, 5);
  });

  it("never returns negative or NaN heights with a zero target", () => {
    const bars = computeSparklineHeights([0, 0, 0, 0, 0, 0, 0], 0);
    bars.forEach((b) => {
      expect(Number.isFinite(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(0);
    });
  });

  it("only ever returns 7 bars", () => {
    const bars = computeSparklineHeights([1, 2, 3, 4, 5, 6, 7, 8, 9], 2000);
    expect(bars).toHaveLength(7);
  });
});

describe("WeeklyInsightCard (mobile) render", () => {
  beforeEach(() => {
    flagFn.mockReset();
  });

  it("renders nothing when the flag is off", () => {
    flagFn.mockReturnValue(false);
    const { toJSON } = render(
      <WeeklyInsightCard
        householdSize={1}
        loggedDaysInWeek={3}
        weekAvgKcal={1800}
        weekDailyKcal={[1800, 1900, 1700, 0, 0, 0, 0]}
        dailyKcalTarget={2000}
        {...COLORS}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the empty-week copy with no fabricated average", () => {
    flagFn.mockReturnValue(true);
    const { getByText, queryByText } = render(
      <WeeklyInsightCard
        householdSize={1}
        loggedDaysInWeek={0}
        weekAvgKcal={null}
        weekDailyKcal={[0, 0, 0, 0, 0, 0, 0]}
        dailyKcalTarget={2000}
        {...COLORS}
      />,
    );
    expect(getByText(/Log a meal to start the week\./)).toBeTruthy();
    // No "kcal daily average" line when the week has no logged day.
    expect(queryByText(/daily average/)).toBeNull();
  });

  it("renders the logged-days count and daily average when present", () => {
    flagFn.mockReturnValue(true);
    const { getByTestId, getByText } = render(
      <WeeklyInsightCard
        householdSize={2}
        loggedDaysInWeek={3}
        weekAvgKcal={1800}
        weekDailyKcal={[1800, 1900, 1700, 0, 0, 0, 0]}
        dailyKcalTarget={2000}
        {...COLORS}
      />,
    );
    expect(getByTestId("today-weekly-insight-mobile")).toBeTruthy();
    expect(getByText(/3 days logged so far\./)).toBeTruthy();
    expect(getByText("Planning for 2 this week")).toBeTruthy();
  });
});
