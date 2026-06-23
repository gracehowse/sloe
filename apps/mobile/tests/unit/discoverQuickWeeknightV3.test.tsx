// @vitest-environment jsdom
/**
 * DiscoverQuickWeeknight (ENG-1225 Block 6) — the v3 Discover "Quick weeknight"
 * section. Pins the flag + empty gating, the quick-recipe derivation, the card
 * meta, and the onPress wiring.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

const isFeatureEnabled = vi.fn(() => true);
vi.mock("@/lib/analytics", () => ({ isFeatureEnabled: () => isFeatureEnabled() }));
vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#221B26",
    textSecondary: "#6A6072",
    textTertiary: "#9B93A3",
  }),
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));

import { DiscoverQuickWeeknight } from "../../components/discover/DiscoverQuickWeeknight";
import type { RecipeCard } from "../../lib/types";

const rc = (id: string, o: Partial<RecipeCard> = {}): RecipeCard =>
  ({
    id,
    title: id,
    image: "",
    creatorName: "",
    creatorImage: "",
    servings: 1,
    calories: 420,
    protein: 28,
    carbs: 40,
    fat: 12,
    isVerified: false,
    savedCount: 0,
    isSaved: false,
    prepTimeMin: 8,
    cookTimeMin: 12,
    ...o,
  }) as RecipeCard;

describe("DiscoverQuickWeeknight", () => {
  it("renders quick recipes with meta + fires onPress", () => {
    const onPressRecipe = vi.fn();
    const { getByText, getByLabelText } = render(
      <DiscoverQuickWeeknight
        recipes={[
          rc("Egg wrap", { calories: 360, protein: 22, prepTimeMin: 3, cookTimeMin: 4 }),
          rc("Slow stew", { prepTimeMin: 20, cookTimeMin: 40 }), // not quick → dropped
        ]}
        onPressRecipe={onPressRecipe}
      />,
    );
    expect(getByText("Quick weeknight")).toBeTruthy();
    expect(getByText("Egg wrap")).toBeTruthy();
    expect(getByText("360 kcal · 22g · 7 min")).toBeTruthy();
    fireEvent.press(getByLabelText(/Egg wrap/));
    expect(onPressRecipe).toHaveBeenCalledWith(expect.objectContaining({ id: "Egg wrap" }));
  });

  it("renders nothing when there are no quick recipes", () => {
    const { queryByText } = render(
      <DiscoverQuickWeeknight
        recipes={[rc("Slow", { prepTimeMin: 30, cookTimeMin: 40 })]}
        onPressRecipe={() => {}}
      />,
    );
    expect(queryByText("Quick weeknight")).toBeNull();
  });

  it("renders nothing when the flag is off", () => {
    isFeatureEnabled.mockReturnValueOnce(false);
    const { queryByText } = render(
      <DiscoverQuickWeeknight recipes={[rc("Egg wrap")]} onPressRecipe={() => {}} />,
    );
    expect(queryByText("Quick weeknight")).toBeNull();
  });
});
