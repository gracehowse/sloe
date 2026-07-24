// @vitest-environment jsdom
/**
 * DiscoverQuickWeeknight (ENG-1225 Block 6) — the v3 Discover "Quick weeknight"
 * section. Pins the flag + empty gating, the quick-recipe derivation, the card
 * meta, and the onPress wiring.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

const featureFlags = vi.hoisted(() => ({
  values: new Map<string, boolean>(),
}));
const recipeCardImage = vi.hoisted(() => vi.fn((_props: unknown) => null));

vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: (flag: string) => featureFlags.values.get(flag) ?? false,
}));
vi.mock("@/components/library/RecipeCardImage", () => ({
  RecipeCardImage: (props: unknown) => recipeCardImage(props),
}));
vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    backgroundSecondary: "#F8F4F0",
    card: "#FFFFFF",
    primaryForeground: "#FFFFFF",
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
  beforeEach(() => {
    featureFlags.values.clear();
    featureFlags.values.set("sloe_v3_discover_editorial", true);
    featureFlags.values.set("discover_photographic_first_view_v1", true);
    // Mirrors the real registry — `design_consistency_v1` is in
    // REDESIGN_DEFAULT_ON (apps/mobile/lib/analytics.ts).
    featureFlags.values.set("design_consistency_v1", true);
    recipeCardImage.mockClear();
  });

  it("renders real recipe media with meta + fires onPress", () => {
    const onPressRecipe = vi.fn();
    const { getByText, getByLabelText, getByTestId } = render(
      <DiscoverQuickWeeknight
        recipes={[
          rc("Egg wrap", {
            image: "https://example.com/egg-wrap.jpg",
            calories: 360,
            protein: 22,
            prepTimeMin: 3,
            cookTimeMin: 4,
          }),
          rc("Slow stew", { prepTimeMin: 20, cookTimeMin: 40 }), // not quick → dropped
        ]}
        onPressRecipe={onPressRecipe}
      />,
    );
    expect(getByText("Quick weeknight")).toBeTruthy();
    expect(getByText("Egg wrap")).toBeTruthy();
    // `design_consistency_v1` (default-ON) labels the protein figure — it was
    // the only unlabelled datum in a recipe meta line — so the card now reads
    // the same shape as `RecipeCardWide` / `FeaturedHero`.
    expect(getByText("360 kcal · 22g protein · 7 min")).toBeTruthy();
    expect(getByTestId("quick-weeknight-photo-Egg wrap")).toBeTruthy();
    expect(recipeCardImage).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: "https://example.com/egg-wrap.jpg",
        recipeId: "Egg wrap",
      }),
    );
    fireEvent.press(getByLabelText(/Egg wrap/));
    expect(onPressRecipe).toHaveBeenCalledWith(expect.objectContaining({ id: "Egg wrap" }));
  });

  /**
   * Design-consistency pass (2026-07-24): the cook time used to be printed
   * twice on this card — a pill on the photo AND the meta line just below —
   * and the protein figure was the only unlabelled datum in any recipe meta
   * line in the product. The pill is gone and the macro is labelled; the
   * kill switch restores both. Web twin:
   * `tests/unit/discoverQuickWeeknightV3Web.test.tsx`.
   */
  it("prints the cook time once — the meta line, not a pill on the photo", () => {
    const { getByText, queryByText } = render(
      <DiscoverQuickWeeknight
        recipes={[
          rc("Egg wrap", { calories: 360, protein: 22, prepTimeMin: 3, cookTimeMin: 4 }),
        ]}
        onPressRecipe={() => {}}
      />,
    );
    expect(getByText("360 kcal · 22g protein · 7 min")).toBeTruthy();
    expect(queryByText("7 min")).toBeNull();
  });

  it("kill switch restores the duplicated time pill and the bare macro", () => {
    featureFlags.values.set("design_consistency_v1", false);
    const { getByText } = render(
      <DiscoverQuickWeeknight
        recipes={[
          rc("Egg wrap", { calories: 360, protein: 22, prepTimeMin: 3, cookTimeMin: 4 }),
        ]}
        onPressRecipe={() => {}}
      />,
    );
    expect(getByText("360 kcal · 22g · 7 min")).toBeTruthy();
    expect(getByText("7 min"), "the photo pill is back").toBeTruthy();
  });

  it("restores the legacy tint card when the photographic flag is off", () => {
    featureFlags.values.set("discover_photographic_first_view_v1", false);
    const { getByTestId, queryByTestId } = render(
      <DiscoverQuickWeeknight recipes={[rc("Egg wrap")]} onPressRecipe={() => {}} />,
    );

    expect(getByTestId("quick-weeknight-tint-Egg wrap")).toBeTruthy();
    expect(queryByTestId("quick-weeknight-photo-Egg wrap")).toBeNull();
    expect(recipeCardImage).not.toHaveBeenCalled();
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
    featureFlags.values.set("sloe_v3_discover_editorial", false);
    const { queryByText } = render(
      <DiscoverQuickWeeknight recipes={[rc("Egg wrap")]} onPressRecipe={() => {}} />,
    );
    expect(queryByText("Quick weeknight")).toBeNull();
  });
});
