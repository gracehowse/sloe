/**
 * TodayWeeklyInsightCard — desktop right-rail summary on the Today
 * view. The card is purely informational; tests pin the non-fabrication
 * rules (no "0 kcal average" when nothing is logged, plural/singular
 * copy for logged days, and the household-size heading line).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { TodayWeeklyInsightCard } from "../../src/app/components/suppr/today-weekly-insight-card";

describe("TodayWeeklyInsightCard", () => {
  const base = {
    householdSize: 1,
    loggedDaysInWeek: 0,
    weekAvgKcal: null as number | null,
    weekDailyKcal: [0, 0, 0, 0, 0, 0, 0],
    dailyKcalTarget: 2100,
  };

  it("shows the empty-week copy when no days are logged", () => {
    render(<TodayWeeklyInsightCard {...base} />);
    expect(screen.getByText(/Log a meal to start the week\./)).toBeDefined();
    // Never invent an average kcal when nothing is logged.
    expect(screen.queryByText(/daily average/)).toBeNull();
  });

  it("renders singular copy for exactly one logged day", () => {
    render(
      <TodayWeeklyInsightCard
        {...base}
        loggedDaysInWeek={1}
        weekAvgKcal={1800}
        weekDailyKcal={[1800, 0, 0, 0, 0, 0, 0]}
      />,
    );
    expect(screen.getByText(/1 day logged so far\./)).toBeDefined();
    expect(screen.getByText(/1,800/)).toBeDefined();
    expect(screen.getByText(/daily average/)).toBeDefined();
  });

  it("renders plural copy for multiple logged days", () => {
    render(
      <TodayWeeklyInsightCard
        {...base}
        loggedDaysInWeek={4}
        weekAvgKcal={2050}
        weekDailyKcal={[2000, 2100, 2050, 2050, 0, 0, 0]}
      />,
    );
    expect(screen.getByText(/4 days logged so far\./)).toBeDefined();
    expect(screen.getByText(/2,050/)).toBeDefined();
  });

  it("shows household copy when householdSize > 1", () => {
    render(
      <TodayWeeklyInsightCard
        {...base}
        householdSize={4}
      />,
    );
    expect(screen.getByText(/Planning for 4 this week/)).toBeDefined();
  });

  it("shows solo copy when householdSize === 1", () => {
    render(<TodayWeeklyInsightCard {...base} />);
    expect(screen.getByText(/Planning for you this week/)).toBeDefined();
  });

  it("hides the household heading when householdSize === 0", () => {
    render(<TodayWeeklyInsightCard {...base} householdSize={0} />);
    expect(screen.queryByText(/Planning for/)).toBeNull();
  });

  it("labels the sparkline with the logged-days count for a11y", () => {
    render(
      <TodayWeeklyInsightCard
        {...base}
        loggedDaysInWeek={3}
        weekAvgKcal={2000}
        weekDailyKcal={[2000, 2000, 0, 2000, 0, 0, 0]}
      />,
    );
    const sparkline = screen.getByRole("img");
    expect(sparkline.getAttribute("aria-label")).toContain("3 days logged");
  });
});
