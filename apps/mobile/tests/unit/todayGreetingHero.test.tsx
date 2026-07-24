// @vitest-environment jsdom
/**
 * TodayGreetingHero — the v3 serif date hero extracted from TodayScreen.tsx
 * (ENG-1609, 2026-07-20) as part of the strip→hero dead-band fix. Previously
 * this block was only reachable via source-pins on the 5,900-line host file;
 * as its own component it can be mounted and asserted directly.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayGreetingHero } from "../../components/today/TodayGreetingHero";
import { todayDayName, todayShortDate } from "@suppr/shared/copy/today";

void React;

const COLORS = {
  text: "#111111",
  textTertiary: "#777777",
  border: "#dddddd",
};

const ACCENT = { primarySolid: "#5B7A5C" };

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => COLORS,
}));
vi.mock("@/context/theme", () => ({
  useAccent: () => ACCENT,
}));

describe("TodayGreetingHero (ENG-1609)", () => {
  it("renders nothing in week view", () => {
    const { queryByTestId } = render(
      <TodayGreetingHero viewMode="week" isToday selectedDate={new Date(2026, 6, 20)} />,
    );
    expect(queryByTestId("today-hero-greeting")).toBeNull();
  });

  it("shows the TODAY eyebrow + day name/short date merged onto one line on today's date", () => {
    const selectedDate = new Date(2026, 6, 20); // 2026-07-20 (Monday)
    const { getByTestId, getByText, queryByTestId } = render(
      <TodayGreetingHero viewMode="day" isToday selectedDate={selectedDate} />,
    );
    expect(getByText("TODAY")).toBeTruthy();
    // 2026-07-24 (Grace): day name + date merge onto ONE serif line on
    // today — no separate subline element (that's past-day-only now).
    // En-space (` `) separator — matches web's NutritionTracker hero.
    expect(getByTestId("today-hero-greeting").props.children).toBe(
      `${todayDayName(selectedDate)} ${todayShortDate(selectedDate)}`,
    );
    expect(queryByTestId("today-hero-greeting-subline")).toBeNull();
  });

  it("hides the TODAY eyebrow on a historic day and shows the long-date headline", () => {
    const pastDate = new Date(2026, 6, 10);
    const { queryByText, getByTestId } = render(
      <TodayGreetingHero viewMode="day" isToday={false} selectedDate={pastDate} />,
    );
    expect(queryByText("TODAY")).toBeNull();
    // Historic-day headline is a full "long date" string (see
    // `todayPastDayGreetingLines`), never the bare weekday name used for today.
    expect(getByTestId("today-hero-greeting").props.children).not.toBe(todayDayName(pastDate));
  });
});
