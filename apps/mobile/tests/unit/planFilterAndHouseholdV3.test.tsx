// @vitest-environment jsdom
/**
 * PlanMealFilterChipsV3 + PlanHouseholdBannerV3 (ENG-1225 Block 2) — the v3 Plan
 * meal-filter chip row and household context banner.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textSecondary: "#5E5566",
    textTertiary: "#9B93A3",
    navPrimary: "#3B2A4D",
    card: "#FFFFFF",
    backgroundSecondary: "#F5F4F7",
    border: "#E8E2EC",
  }),
}));
// FilterChip reads the scheme-resolved accent; mock so the test doesn't pull
// the real ThemeContext (AsyncStorage etc.).
vi.mock("@/context/theme", () => ({
  useAccent: () => ({
    primarySolid: "#3B2A4D",
    primarySoft: "rgba(91, 59, 110, 0.12)",
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

  it("selection is the shared §7 FilterChip soft tint — no solid navPrimary fill (chip ruling 2026-07-10, source pin)", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/plan/PlanMealFilterChipsV3.tsx"),
      "utf8",
    );
    expect(src).toMatch(/from "@\/components\/ui\/FilterChip"/);
    expect(src).not.toMatch(/navPrimary/);
    expect(src).not.toMatch(/#fff/i);
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
