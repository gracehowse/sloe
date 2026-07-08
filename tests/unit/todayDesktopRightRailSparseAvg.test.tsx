// @vitest-environment jsdom

/**
 * ENG-1372 slice 2 — TodayDesktopRightRail sparse-average suppression (web).
 *
 * The "This week" card's header showed "{avg} avg" whenever the caller
 * passed a non-null `weekAvgKcal` — previously gated only on >0 logged
 * days, so a SINGLE logged day's total rendered as if it were a stable
 * week average (law 3: no derived stat from <3 data points). The caller
 * (`NutritionTracker.tsx`) now passes `null` below 3 logged days when
 * `empty_state_grammar_v1` is on; this component itself carries no gating
 * logic (slice-1 pattern) — it just hides the "avg" span when the prop is
 * null and leaves the footer's "{n}/7 days logged" line as the honest stat.
 *
 * Mobile parity: `apps/mobile/tests/unit/weeklyInsightCardMobile.test.tsx`
 * (`WeeklyInsightCard`, fed by the equivalent gate in
 * `apps/mobile/app/(tabs)/_today/TodayScreen.tsx`).
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { TodayDesktopRightRail } from "../../src/app/components/suppr/today-desktop-right-rail";

const baseProps = {
  targetKcal: 2000,
  weekDailyKcal: [0, 0, 0, 0, 0, 0, 0],
  weekDayLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  streakDays: 0,
  activeDateKey: "2026-07-08",
  todayDateKey: "2026-07-08",
  byDay: {},
  onSelectDayKey: vi.fn(),
};

describe("TodayDesktopRightRail — 'This week' sparse average (web)", () => {
  it("hides the '{n} avg' stat when the caller passes null (below-floor gate)", () => {
    render(
      <TodayDesktopRightRail {...baseProps} weekLoggedDays={1} weekAvgKcal={null} />,
    );
    expect(screen.queryByText(/avg$/)).toBeNull();
    expect(screen.getByText("1/7 days logged")).toBeTruthy();
  });

  it("renders the '{n} avg' stat once the caller passes a real value (>=3 days, flag on)", () => {
    render(
      <TodayDesktopRightRail {...baseProps} weekLoggedDays={3} weekAvgKcal={1900} />,
    );
    expect(screen.getByText("1,900 avg")).toBeTruthy();
    expect(screen.getByText("3/7 days logged")).toBeTruthy();
  });

  it("0 logged days: no avg, honest 'Start logging' copy", () => {
    render(
      <TodayDesktopRightRail {...baseProps} weekLoggedDays={0} weekAvgKcal={null} />,
    );
    expect(screen.queryByText(/avg$/)).toBeNull();
    expect(screen.getByText("Start logging to see your week.")).toBeTruthy();
  });
});
