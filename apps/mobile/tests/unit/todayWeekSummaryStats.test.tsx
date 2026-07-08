// @vitest-environment jsdom

/**
 * ENG-1372 slice 2 — TodayWeekSummaryStats sparse-stat suppression (mobile).
 * Web parity: `tests/unit/todayWeekSummaryStatsWeb.test.tsx`.
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

const isFeatureEnabledMock = vi.fn((_flag: string) => true);
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: (flag: string) => isFeatureEnabledMock(flag),
}));

import { TodayWeekSummaryStats } from "../../components/today/TodayWeekSummaryStats";

const baseProps = {
  totalCalories: 3400,
  avgCalories: 1700,
  maintenanceKcal: 2200,
  accentPrimarySolid: "#3B2A4D",
  textColor: "#221B26",
  textSecondaryColor: "#6A6072",
  cardStyle: {},
  cardTitleStyle: {},
};

describe("TodayWeekSummaryStats — sparse days (mobile)", () => {
  it("flag ON + <3 logged days: suppresses 'Daily avg', shows '{n}/7 days logged'", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    const { getByTestId, getByText, queryByText } = render(
      <TodayWeekSummaryStats {...baseProps} daysWithFood={2} />,
    );
    expect(getByTestId("today-week-days-logged-stat").props.children.join("")).toBe("2/7");
    expect(getByText("Days logged")).toBeTruthy();
    expect(queryByText("Daily avg")).toBeNull();
  });

  it("flag ON + 0 logged days: still an honest '0/7 days logged', not '0 avg'", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    const { getByTestId } = render(
      <TodayWeekSummaryStats {...baseProps} daysWithFood={0} avgCalories={0} />,
    );
    expect(getByTestId("today-week-days-logged-stat").props.children.join("")).toBe("0/7");
  });

  it("flag ON + >=3 logged days: keeps 'Daily avg' (average is earned at 3+ days)", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    const { getByText, queryByTestId } = render(
      <TodayWeekSummaryStats {...baseProps} daysWithFood={3} />,
    );
    expect(getByText("Daily avg")).toBeTruthy();
    expect(queryByTestId("today-week-days-logged-stat")).toBeNull();
  });

  it("flag OFF: keeps legacy 'Daily avg' even at <3 logged days (OFF renders legacy exactly)", () => {
    isFeatureEnabledMock.mockReturnValue(false);
    const { getByText, queryByTestId } = render(
      <TodayWeekSummaryStats {...baseProps} daysWithFood={1} />,
    );
    expect(getByText("Daily avg")).toBeTruthy();
    expect(queryByTestId("today-week-days-logged-stat")).toBeNull();
  });

  it("Total kcal + Net deficit/surplus tiles are untouched by the sparse-stat logic", () => {
    isFeatureEnabledMock.mockReturnValue(true);
    const { getByText } = render(
      <TodayWeekSummaryStats {...baseProps} daysWithFood={1} />,
    );
    expect(getByText("Total kcal")).toBeTruthy();
    expect(getByText("Net deficit")).toBeTruthy();
  });
});
