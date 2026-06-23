// @vitest-environment jsdom
/**
 * DiscoverCollections (ENG-1225 Block 6) — the v3 Discover gradient-tile
 * collections that deep-link into category pills. Pins flag/empty gating, the
 * live count, the labels, and the onSelectCategory wiring.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

const isFeatureEnabled = vi.fn(() => true);
vi.mock("@/lib/analytics", () => ({ isFeatureEnabled: () => isFeatureEnabled() }));
vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ text: "#221B26" }),
}));
vi.mock("expo-haptics", () => ({
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  impactAsync: vi.fn(),
  NotificationFeedbackType: { Success: "success" },
  ImpactFeedbackStyle: { Light: "light" },
}));

import { DiscoverCollections } from "../../components/discover/DiscoverCollections";
import type { RecipeCard } from "../../lib/types";

const rc = (id: string, o: Partial<RecipeCard> = {}): RecipeCard =>
  ({
    id,
    title: id,
    image: "",
    creatorName: "",
    creatorImage: "",
    servings: 1,
    calories: 500,
    protein: 40, // high protein
    carbs: 40,
    fat: 12,
    isVerified: false,
    savedCount: 0,
    isSaved: false,
    prepTimeMin: 5,
    cookTimeMin: 10, // quick
    ...o,
  }) as RecipeCard;

describe("DiscoverCollections", () => {
  it("renders tiles with live counts and fires onSelectCategory", () => {
    const onSelectCategory = vi.fn();
    const recipes = [rc("a"), rc("b"), rc("c")]; // all qualify for both
    const { getByLabelText, getByText } = render(
      <DiscoverCollections recipes={recipes} onSelectCategory={onSelectCategory} />,
    );
    expect(getByText("Collections")).toBeTruthy();
    expect(getByText("High-protein dinners")).toBeTruthy();
    expect(getByText("Under 30 minutes")).toBeTruthy();
    expect(getByLabelText(/High-protein dinners, 3 recipes/)).toBeTruthy();
    fireEvent.press(getByLabelText(/Under 30 minutes/));
    expect(onSelectCategory).toHaveBeenCalledWith("quick");
  });

  it("hides tiles with zero matching recipes", () => {
    // No quick recipes, but high-protein matches.
    const recipes = [rc("slow", { prepTimeMin: 30, cookTimeMin: 40 })];
    const { getByText, queryByText } = render(
      <DiscoverCollections recipes={recipes} onSelectCategory={() => {}} />,
    );
    expect(getByText("High-protein dinners")).toBeTruthy();
    expect(queryByText("Under 30 minutes")).toBeNull();
  });

  it("renders nothing when no tile qualifies", () => {
    const recipes = [rc("none", { protein: 5, prepTimeMin: 30, cookTimeMin: 40 })];
    const { queryByText } = render(
      <DiscoverCollections recipes={recipes} onSelectCategory={() => {}} />,
    );
    expect(queryByText("Collections")).toBeNull();
  });

  it("renders nothing when the flag is off", () => {
    isFeatureEnabled.mockReturnValueOnce(false);
    const { queryByText } = render(
      <DiscoverCollections recipes={[rc("a")]} onSelectCategory={() => {}} />,
    );
    expect(queryByText("Collections")).toBeNull();
  });
});
