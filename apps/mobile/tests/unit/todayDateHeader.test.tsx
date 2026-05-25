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

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayDateHeader } from "../../components/today/TodayDateHeader";

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
  default: () => null,
}));

vi.mock("@/components/GradientAvatar", () => ({
  GradientAvatar: () => null,
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
