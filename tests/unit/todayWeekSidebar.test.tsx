/**
 * TodayWeekSidebar — desktop right-rail week strip (ENG-590).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayWeekSidebar } from "../../src/app/components/suppr/today-week-sidebar";

describe("TodayWeekSidebar", () => {
  it("renders seven day rows and highlights the active date", () => {
    const onSelect = vi.fn();
    render(
      <TodayWeekSidebar
        byDay={{
          "2026-05-19": [{ calories: 1200 }],
          "2026-05-18": [{ calories: 800 }],
        }}
        calorieTarget={2000}
        activeDateKey="2026-05-18"
        todayDateKey="2026-05-19"
        onSelectDayKey={onSelect}
      />,
    );

    expect(screen.getByRole("complementary", { name: "Last 7 days" })).toBeTruthy();
    const rows = screen.getAllByRole("button");
    expect(rows.length).toBe(7);
    expect(screen.getByRole("button", { current: true })).toBeTruthy();
  });

  it("calls onSelectDayKey when a row is pressed", () => {
    const onSelect = vi.fn();
    render(
      <TodayWeekSidebar
        byDay={{}}
        calorieTarget={1800}
        activeDateKey="2026-05-19"
        todayDateKey="2026-05-19"
        onSelectDayKey={onSelect}
      />,
    );
    const mondayRow = screen.getAllByRole("button")[0];
    mondayRow.click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(typeof onSelect.mock.calls[0][0]).toBe("string");
  });
});
