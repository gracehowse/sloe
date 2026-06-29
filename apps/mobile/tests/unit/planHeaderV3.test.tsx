// @vitest-environment jsdom
/**
 * PlanHeaderV3 (ENG-1225, v3 Plan IA) — the Plan header + week-verdict row.
 * Pins the prototype contract (Sloe-App.html Plan ~L4707-4721): date overline +
 * "Your plan" title, two action buttons (generate / templates), and a verdict row driven by
 * `computePlanWeekVerdict` (completeness, not calorie accuracy).
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textTertiary: "#9B93A3",
    backgroundSecondary: "#F5F4F7",
  }),
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

import { PlanHeaderV3 } from "../../components/plan/PlanHeaderV3";
import type { PlanWeekVerdict } from "@suppr/shared/planning/planWeekStatus";

const partial: PlanWeekVerdict = {
  daysHit: 4,
  total: 7,
  headline: "On track — 4 of 7 days land",
  subline: "3 days need a meal or swap",
  tone: "warning",
};
const win: PlanWeekVerdict = {
  daysHit: 7,
  total: 7,
  headline: "Every day lands on target",
  subline: null,
  tone: "success",
};

const baseProps = {
  dateRangeLabel: "16–22 June",
  onGenerate: () => {},
  onAdjust: () => {},
  onTemplates: () => {},
};

describe("PlanHeaderV3", () => {
  it("renders the title + uppercased date overline", () => {
    const { getByText } = render(<PlanHeaderV3 {...baseProps} verdict={partial} />);
    expect(getByText("Your plan")).toBeTruthy();
    expect(getByText("16–22 JUNE")).toBeTruthy();
  });

  it("renders the partial verdict headline + nudge subline", () => {
    const { getByText } = render(<PlanHeaderV3 {...baseProps} verdict={partial} />);
    expect(getByText("On track — 4 of 7 days land")).toBeTruthy();
    expect(getByText("3 days need a meal or swap")).toBeTruthy();
  });

  it("renders the win verdict with no nudge subline", () => {
    const { getByText, queryByText } = render(
      <PlanHeaderV3 {...baseProps} verdict={win} />,
    );
    expect(getByText("Every day lands on target")).toBeTruthy();
    expect(queryByText(/need[s]? a meal or swap/)).toBeNull();
  });

  it("hides the verdict row when verdict is null (header still renders)", () => {
    const { getByText, queryByText } = render(
      <PlanHeaderV3 {...baseProps} verdict={null} />,
    );
    expect(getByText("Your plan")).toBeTruthy();
    expect(queryByText(/days land/)).toBeNull();
  });

  it("exposes the action buttons and fires their handlers", () => {
    const onGenerate = vi.fn();
    const onAdjust = vi.fn();
    const onTemplates = vi.fn();
    const { getByLabelText } = render(
      <PlanHeaderV3
        {...baseProps}
        verdict={partial}
        onGenerate={onGenerate}
        onAdjust={onAdjust}
        onTemplates={onTemplates}
      />,
    );
    fireEvent.press(getByLabelText("Generate week"));
    fireEvent.press(getByLabelText("Adjust constraints"));
    fireEvent.press(getByLabelText("Templates"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onAdjust).toHaveBeenCalledTimes(1);
    expect(onTemplates).toHaveBeenCalledTimes(1);
  });
});
