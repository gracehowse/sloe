// @vitest-environment jsdom
/**
 * PlanMealFilterChipsV3 + PlanHouseholdBannerV3 (ENG-1225 Block 2) — the v3 Plan
 * meal-filter chip row and household context banner.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textTertiary: "#9B93A3",
    navPrimary: "#3B2A4D",
    backgroundSecondary: "#F5F4F7",
    border: "#E8E2EC",
  }),
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));

import { PlanMealFilterChipsV3 } from "../../components/plan/PlanMealFilterChipsV3";
import {
  PlanHouseholdBannerV3,
  type PlanHouseholdMember,
} from "../../components/plan/PlanHouseholdBannerV3";

describe("PlanMealFilterChipsV3", () => {
  it("renders all five chips with 'All meals' label", () => {
    const { getByLabelText } = render(
      <PlanMealFilterChipsV3 selected="All" onSelect={() => {}} />,
    );
    for (const l of ["All meals", "Breakfast", "Lunch", "Dinner", "Snack"]) {
      expect(getByLabelText(l)).toBeTruthy();
    }
  });

  it("marks the selected chip + fires onSelect with the filter key", () => {
    const onSelect = vi.fn();
    const { getByLabelText } = render(
      <PlanMealFilterChipsV3 selected="Lunch" onSelect={onSelect} />,
    );
    expect(getByLabelText("Lunch").props.accessibilityState?.selected).toBe(true);
    expect(getByLabelText("All meals").props.accessibilityState?.selected).toBe(
      false,
    );
    fireEvent.press(getByLabelText("Dinner"));
    expect(onSelect).toHaveBeenCalledWith("Dinner");
  });
});

const members: PlanHouseholdMember[] = [
  { initial: "G", isOwner: true },
  { initial: "S", isOwner: false },
  { initial: "M", isOwner: false },
];

describe("PlanHouseholdBannerV3", () => {
  it("renders the cooking-for line + avatars + a chevron when matched", () => {
    const { getByText } = render(
      <PlanHouseholdBannerV3
        members={members}
        servingCount={3}
        names="Grace, Sam, Mia"
        mismatchEaters={null}
        onPress={() => {}}
      />,
    );
    expect(getByText("Cooking for 3 · Grace, Sam, Mia")).toBeTruthy();
    expect(getByText("G")).toBeTruthy();
    expect(getByText("M")).toBeTruthy();
  });

  it("shows the mismatch flag when servings ≠ eaters + fires onPress", () => {
    const onPress = vi.fn();
    const { getByText, getByLabelText } = render(
      <PlanHouseholdBannerV3
        members={members}
        servingCount={2}
        names="Grace, Sam, Mia"
        mismatchEaters={3}
        onPress={onPress}
      />,
    );
    expect(getByText("3× — match")).toBeTruthy();
    fireEvent.press(getByLabelText(/Cooking for 2/));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
