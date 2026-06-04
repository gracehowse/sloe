/**
 * TodayDateHeader — mobile component pin.
 *
 * Authority: premium-bar audit DC8 polish (2026-05-14) — streak chip
 * moved into the date-header row + Duolingo supportive reset-day
 * copy. The pip used to live as a standalone block above the date
 * header; the audit inlines it next to the "Today" pill so the
 * week-strip row reads as a single calm unit.
 *
 * Pins:
 *   - When `streakDays >= 2` and view is day+today, the inline pip renders.
 *   - When `streakDays < 2`, the pip is suppressed (existing day-1 carve-out).
 *   - When `streakResetCopyVisible` is true, the supportive line renders
 *     and the numeric pip is hidden.
 *   - When week view is active, the pip is suppressed regardless.
 */

import React from "react";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayDateHeader } from "../../components/today/TodayDateHeader";

void React;

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#666",
    textTertiary: "#999",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
    border: "#ddd",
    primaryForeground: "#fff",
  }),
}));

vi.mock("@/components/charts/DayStrip", () => ({
  default: () => <Text testID="day-strip">strip</Text>,
}));

vi.mock("@/components/GradientAvatar", () => ({
  GradientAvatar: () => <Text testID="gradient-avatar">avatar</Text>,
}));

const baseProps = {
  viewMode: "day" as const,
  onViewModeChange: () => {},
  selectedDate: new Date(2026, 3, 22),
  weekLabel: "16 Apr – 22 Apr",
  isToday: true,
  formatDateLabel: (d: Date) => d.toLocaleDateString("en-US"),
  weekStartDay: "monday" as const,
  loggedDays: new Set<string>(),
  protectedDateKeys: new Set<string>(),
  onSelectDate: () => {},
  onOpenCalendar: () => {},
  onNavigatePrev: () => {},
  onNavigateNext: () => {},
  onTapTitle: () => {},
  avatarLetter: "G",
  textColor: "#000",
  textSecondaryColor: "#666",
  textTertiaryColor: "#999",
  cardColor: "#fff",
  cardBorderColor: "#eee",
  primaryForegroundColor: "#fff",
};

describe("TodayDateHeader — inline StreakPip (DC8 polish 2026-05-14)", () => {
  it("suppresses the inline streak pip on cold-open Today (2026-05-22 A3)", () => {
    const { queryByLabelText } = render(
      <TodayDateHeader {...baseProps} streakDays={5} onStreakPress={() => {}} />,
    );
    expect(queryByLabelText(/logging streak/i)).toBeNull();
  });

  it("suppresses the pip when streakDays < 2 (day-0 / day-1 carve-out)", () => {
    const { queryByLabelText } = render(
      <TodayDateHeader {...baseProps} streakDays={1} onStreakPress={() => {}} />,
    );
    expect(queryByLabelText(/logging streak/i)).toBeNull();
  });

  it("suppresses the pip on week view even when streakDays >= 2", () => {
    const { queryByLabelText } = render(
      <TodayDateHeader
        {...baseProps}
        viewMode="week"
        streakDays={7}
        onStreakPress={() => {}}
      />,
    );
    expect(queryByLabelText(/logging streak/i)).toBeNull();
  });

  it("renders the supportive reset-day copy when streakResetCopyVisible is true", () => {
    const { getByText, queryByLabelText } = render(
      <TodayDateHeader
        {...baseProps}
        streakDays={0}
        streakResetCopyVisible
        onStreakPress={() => {}}
      />,
    );
    expect(
      getByText(/Every expert was once a beginner\. Start fresh today\./i),
    ).toBeTruthy();
    // Numeric pip is hidden during the reset moment.
    expect(queryByLabelText(/logging streak/i)).toBeNull();
  });

  it("when both streakDays >= 2 and reset copy are set, the reset copy wins (calm posture)", () => {
    // Edge case: host hasn't cleared `streakResetCopyVisible` yet but the
    // streak value has already climbed. The component favours the reset
    // copy until the host clears the flag, so the user never reads a
    // mixed signal.
    const { getByText, queryByLabelText } = render(
      <TodayDateHeader
        {...baseProps}
        streakDays={3}
        streakResetCopyVisible
        onStreakPress={() => {}}
      />,
    );
    expect(getByText(/Every expert was once a beginner/i)).toBeTruthy();
    expect(queryByLabelText(/logging streak/i)).toBeNull();
  });
});

describe("TodayDateHeader — calm date nav (hideDayStrip, ENG-584)", () => {
  it("shows choose-date on title when day strip hidden (calm date nav)", () => {
    const onOpenCalendar = vi.fn();
    const { getByLabelText, queryByLabelText } = render(
      <TodayDateHeader
        {...baseProps}
        hideDayStrip
        onOpenCalendar={onOpenCalendar}
      />,
    );
    expect(queryByLabelText("Open calendar")).toBeNull();
    const chooseDate = getByLabelText("Choose date");
    expect(chooseDate).toBeTruthy();
    chooseDate.props.onPress?.();
    expect(onOpenCalendar).toHaveBeenCalled();
  });

  it("shows Jump to today when viewing a past day with strip hidden", () => {
    const onTapTitle = vi.fn();
    const { getByLabelText } = render(
      <TodayDateHeader
        {...baseProps}
        hideDayStrip
        isToday={false}
        onTapTitle={onTapTitle}
      />,
    );
    const todayBtn = getByLabelText("Jump to today");
    expect(todayBtn).toBeTruthy();
    todayBtn.props.onPress?.();
    expect(onTapTitle).toHaveBeenCalled();
  });
});

describe("TodayDateHeader — stripOnly (SLOE wordmark-header redesign 2026-06-03)", () => {
  // In stripOnly mode the Today screen supplies its own Sloe wordmark +
  // avatar header above the greeting; this component collapses to the
  // week strip alone. The chevrons, "Today" title, avatar, and
  // day/week toggle all move out.
  it("renders only the week strip (no nav chevrons, no title, no avatar, no toggle)", () => {
    const { getByTestId, queryByTestId, queryByLabelText, queryByText } = render(
      <TodayDateHeader {...baseProps} stripOnly />,
    );
    // The strip is present.
    expect(getByTestId("day-strip")).toBeTruthy();
    // Day-nav chevrons are gone (the strip owns day-selection now).
    expect(queryByLabelText("Previous day")).toBeNull();
    expect(queryByLabelText("Next day")).toBeNull();
    expect(queryByLabelText("Previous week")).toBeNull();
    expect(queryByLabelText("Next week")).toBeNull();
    // The "Today" title and choose-date title are gone.
    expect(queryByText("Today")).toBeNull();
    expect(queryByLabelText("Choose date")).toBeNull();
    // The avatar moved to the wordmark header — not rendered here.
    expect(queryByTestId("gradient-avatar")).toBeNull();
    expect(queryByLabelText("Open settings")).toBeNull();
    // The day/week view-mode toggle is gone.
    expect(queryByLabelText("Day view")).toBeNull();
    expect(queryByLabelText("Week view")).toBeNull();
  });

  it("keeps the supportive streak-reset copy under the strip", () => {
    const { getByText, getByTestId } = render(
      <TodayDateHeader {...baseProps} stripOnly streakResetCopyVisible />,
    );
    expect(getByTestId("day-strip")).toBeTruthy();
    expect(
      getByText(/Every expert was once a beginner\. Start fresh today\./i),
    ).toBeTruthy();
  });

  it("renders the strip even in week view (Today is day-centric; strip is the only date affordance)", () => {
    const { getByTestId } = render(
      <TodayDateHeader {...baseProps} stripOnly viewMode="week" />,
    );
    expect(getByTestId("day-strip")).toBeTruthy();
  });
});
