// @vitest-environment jsdom

/**
 * ENG-1372 slice 2 — TodayWeekSummaryStats sparse-stat suppression (web).
 *
 * The "Weekly summary" tile trio's middle stat is "Daily avg" — a derived
 * average that misleads on a partial week ("929 avg" from one logged day
 * reads as a real week average). Below 3 logged days (law 3), the middle
 * tile suppresses the average and shows the honest stat instead: how many
 * of the 7 days actually have data ("{n}/7 days logged").
 *
 * Mobile parity: `apps/mobile/tests/unit/todayWeekSummaryStats.test.tsx`.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const isFeatureEnabledMock = vi.fn((_flag: string) => true);
vi.mock("../../src/lib/analytics/track", () => ({
  isFeatureEnabled: (flag: string) => isFeatureEnabledMock(flag),
}));

import { TodayWeekSummaryStats } from "../../src/app/components/suppr/today-week-summary-stats";

const baseProps = {
  totalCalories: 3400,
  avgCalories: 1700,
  isDeficit: true,
  deficitOrSurplusDiff: 200,
};

describe("TodayWeekSummaryStats — sparse days (web)", () => {
  it("flag ON + <3 logged days: suppresses 'Daily avg', shows '{n}/7 days logged'", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    render(<TodayWeekSummaryStats {...baseProps} loggedDaysInWeek={2} />);
    expect(screen.getByTestId("today-week-days-logged-stat").textContent).toBe("2/7");
    expect(screen.getByText("Days logged")).toBeTruthy();
    expect(screen.queryByText("Daily avg")).toBeNull();
  });

  it("flag ON + 0 logged days: still an honest '0/7 days logged', not '0 avg'", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    render(<TodayWeekSummaryStats {...baseProps} loggedDaysInWeek={0} avgCalories={0} />);
    expect(screen.getByTestId("today-week-days-logged-stat").textContent).toBe("0/7");
  });

  it("flag ON + >=3 logged days: keeps 'Daily avg' (average is earned at 3+ days)", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    render(<TodayWeekSummaryStats {...baseProps} loggedDaysInWeek={3} />);
    expect(screen.getByText("Daily avg")).toBeTruthy();
    expect(screen.queryByTestId("today-week-days-logged-stat")).toBeNull();
  });

  it("flag OFF: keeps legacy 'Daily avg' even at <3 logged days (OFF renders legacy exactly)", () => {
    isFeatureEnabledMock.mockReturnValue(false);
    render(<TodayWeekSummaryStats {...baseProps} loggedDaysInWeek={1} />);
    expect(screen.getByText("Daily avg")).toBeTruthy();
    expect(screen.queryByTestId("today-week-days-logged-stat")).toBeNull();
  });

  it("Total kcal + Net deficit/surplus tiles are untouched by the sparse-stat logic", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    render(<TodayWeekSummaryStats {...baseProps} loggedDaysInWeek={1} />);
    expect(screen.getByText("Total kcal")).toBeTruthy();
    expect(screen.getByText("Net deficit")).toBeTruthy();
  });
});
