// @vitest-environment jsdom
/**
 * PlanEmptyWeekCard (mobile) — ENG-1372.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textSecondary: "#6A6072",
    navPrimary: "#3B2A4D",
  }),
}));
vi.mock("@/context/theme", () => ({
  useAccent: () => ({ primarySoft: "rgba(91, 59, 110, 0.12)" }),
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));

import { PlanEmptyWeekCard } from "../../components/plan/PlanEmptyWeekCard";

describe("PlanEmptyWeekCard (mobile)", () => {
  it("renders the headline + both actions and fires their handlers", () => {
    let generated = false;
    let addedAsYouGo = false;
    const { getByText } = render(
      <PlanEmptyWeekCard
        onGenerate={() => (generated = true)}
        onAddMealsAsYouGo={() => (addedAsYouGo = true)}
      />,
    );
    expect(getByText("Nothing planned yet")).toBeTruthy();
    fireEvent.press(getByText("Generate this week"));
    expect(generated).toBe(true);
    fireEvent.press(getByText("or add meals as you go"));
    expect(addedAsYouGo).toBe(true);
  });

  it("sits on the cool plum nudge-tint ground (ENG-1496 — beige retired)", () => {
    const { getByTestId } = render(
      <PlanEmptyWeekCard onGenerate={() => {}} onAddMealsAsYouGo={() => {}} />,
    );
    const style = Array.isArray(getByTestId("plan-empty-week-card").props.style)
      ? Object.assign({}, ...getByTestId("plan-empty-week-card").props.style)
      : getByTestId("plan-empty-week-card").props.style;
    expect(style.backgroundColor).toBe("rgba(91, 59, 110, 0.12)");
  });
});
