// @vitest-environment jsdom
/**
 * PlanWeekStripV3 (ENG-1225 Block 2) — the v3 Plan week strip / day selector.
 * Pins the 7-cell day row, the selected-day state, and day selection firing.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textTertiary: "#9B93A3",
    navPrimary: "#3B2A4D",
    borderStrong: "#C9C2D6",
  }),
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));

import {
  PlanWeekStripV3,
  type PlanWeekStripDay,
} from "../../components/plan/PlanWeekStripV3";

const days: PlanWeekStripDay[] = [
  { key: "16", dayLetter: "M", dateNum: 16, status: "full", isToday: false },
  { key: "17", dayLetter: "T", dateNum: 17, status: "full", isToday: false },
  { key: "18", dayLetter: "W", dateNum: 18, status: "part", isToday: false },
  { key: "19", dayLetter: "T", dateNum: 19, status: "empty", isToday: true },
  { key: "20", dayLetter: "F", dateNum: 20, status: "full", isToday: false },
  { key: "21", dayLetter: "S", dateNum: 21, status: "part", isToday: false },
  { key: "22", dayLetter: "S", dateNum: 22, status: "empty", isToday: false },
];

describe("PlanWeekStripV3", () => {
  it("renders all 7 day cells", () => {
    const { getByLabelText } = render(
      <PlanWeekStripV3 days={days} selectedKey="19" onSelectDay={() => {}} />,
    );
    for (const d of days) {
      expect(getByLabelText(`${d.dayLetter} ${d.dateNum}`)).toBeTruthy();
    }
  });

  it("marks the selected day's tab as selected", () => {
    const { getByLabelText } = render(
      <PlanWeekStripV3 days={days} selectedKey="19" onSelectDay={() => {}} />,
    );
    const selected = getByLabelText("T 19");
    expect(selected.props.accessibilityState?.selected).toBe(true);
    const other = getByLabelText("M 16");
    expect(other.props.accessibilityState?.selected).toBe(false);
  });

  it("fires onSelectDay with the tapped day's key", () => {
    const onSelectDay = vi.fn();
    const { getByLabelText } = render(
      <PlanWeekStripV3 days={days} selectedKey="19" onSelectDay={onSelectDay} />,
    );
    fireEvent.press(getByLabelText("F 20"));
    expect(onSelectDay).toHaveBeenCalledWith("20");
  });
});
