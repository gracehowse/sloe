// @vitest-environment jsdom
/**
 * PlanMealCardV3 + PlanEmptySlotV3 (ENG-1225 Block 3) — the v3 Plan per-slot
 * meal card and dashed empty-slot row.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

// ENG-1417 — mutable per-test override, defaults OFF (kill switch) so every
// other test in this file keeps asserting the exact pre-ENG-1417 bare kcal.
let kcalTrustQualifierOn = false;
vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: (flag: string) =>
    flag === "kcal_trust_qualifier_v1" ? kcalTrustQualifierOn : false,
  track: vi.fn(),
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textTertiary: "#9B93A3",
    navPrimary: "#3B2A4D",
    backgroundSecondary: "#F5F4F7",
    border: "#E8E2EC",
    borderStrong: "#C9C2D6",
    card: "#FFFFFF",
  }),
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));
vi.mock("@/components/ui/SmartImage", () => ({ SmartImage: () => null }));

import { PlanMealCardV3 } from "../../components/plan/PlanMealCardV3";
import { PlanEmptySlotV3 } from "../../components/plan/PlanEmptySlotV3";

describe("PlanMealCardV3", () => {
  it("flag OFF: renders the bare kcal regardless of isVerified (ENG-1417)", () => {
    kcalTrustQualifierOn = false;
    const { getByText, queryByText } = render(
      <PlanMealCardV3 slot="Lunch" name="Tahini bowl" kcal={520} isVerified={false} />,
    );
    expect(getByText("520 kcal")).toBeTruthy();
    expect(queryByText("~520 kcal")).toBeNull();
  });

  it("flag ON + unverified: prefixes the kcal with '~' (ENG-1417)", () => {
    kcalTrustQualifierOn = true;
    const { getByText } = render(
      <PlanMealCardV3 slot="Lunch" name="Tahini bowl" kcal={520} isVerified={false} />,
    );
    expect(getByText("~520 kcal")).toBeTruthy();
  });

  it("flag ON + verified: renders the bare kcal, no qualifier (ENG-1417)", () => {
    kcalTrustQualifierOn = true;
    const { getByText, queryByText } = render(
      <PlanMealCardV3 slot="Lunch" name="Tahini bowl" kcal={520} isVerified={true} />,
    );
    expect(getByText("520 kcal")).toBeTruthy();
    expect(queryByText("~520 kcal")).toBeNull();
  });

  it("flag ON + isVerified absent: treats it as unverified — safe default (ENG-1417)", () => {
    kcalTrustQualifierOn = true;
    const { getByText } = render(
      <PlanMealCardV3 slot="Lunch" name="Tahini bowl" kcal={520} />,
    );
    expect(getByText("~520 kcal")).toBeTruthy();
  });

  it("renders slot, name, kcal + fires onPress", () => {
    kcalTrustQualifierOn = false;
    const onPress = vi.fn();
    const { getByText, getByLabelText } = render(
      <PlanMealCardV3
        slot="Lunch"
        name="Tahini bowl"
        kcal={520}
        onPress={onPress}
      />,
    );
    expect(getByText("Lunch")).toBeTruthy();
    expect(getByText("Tahini bowl")).toBeTruthy();
    expect(getByText("520 kcal")).toBeTruthy();
    fireEvent.press(getByLabelText("Lunch: Tahini bowl"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows a lock badge when locked and a Batch chip for a batch note", () => {
    const { getByText, getByLabelText } = render(
      <PlanMealCardV3
        slot="Dinner"
        name="Sunday roast"
        kcal={640}
        isLocked
        note="batch"
      />,
    );
    expect(getByLabelText("Locked")).toBeTruthy();
    expect(getByText("Batch")).toBeTruthy();
  });

  it("renders '—' when kcal is null", () => {
    const { getByText } = render(
      <PlanMealCardV3 slot="Breakfast" name="Mystery meal" kcal={null} />,
    );
    expect(getByText("—")).toBeTruthy();
  });
});

describe("PlanEmptySlotV3", () => {
  it("renders the slot + 'Add {slot}' and fires onPress", () => {
    const onPress = vi.fn();
    const { getByText, getByLabelText } = render(
      <PlanEmptySlotV3 slot="Dinner" onPress={onPress} />,
    );
    expect(getByText("Dinner")).toBeTruthy();
    expect(getByText("Add dinner")).toBeTruthy();
    fireEvent.press(getByLabelText("Add dinner"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
