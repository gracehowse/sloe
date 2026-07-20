/**
 * DiscoverQuickWeeknight web (ENG-1225 Block 6) — the v3 Discover "Quick
 * weeknight" section, web twin. Pins the flag + empty gating, the meta line, and
 * the onPress wiring.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

const featureFlags = vi.hoisted(() => ({
  values: new Map<string, boolean>(),
}));
const discoverRecipeImage = vi.hoisted(() => vi.fn((_props: unknown) => null));

vi.mock("../../src/lib/analytics/track", () => ({
  isFeatureEnabled: (flag: string) => featureFlags.values.get(flag) ?? false,
}));
vi.mock("../../src/app/components/suppr/discover-recipe-image", () => ({
  DiscoverRecipeImage: (props: unknown) => discoverRecipeImage(props),
}));

import { DiscoverQuickWeeknight } from "../../src/app/components/suppr/discover-quick-weeknight";
import type { RecipeCard } from "../../src/types/recipe";

const rc = (id: string, o: Partial<RecipeCard> = {}): RecipeCard =>
  ({
    id,
    title: id,
    image: "https://example.com/recipe.jpg",
    calories: 420,
    protein: 28,
    carbs: 40,
    fat: 12,
    prepTimeMin: 8,
    cookTimeMin: 12,
    ...o,
  }) as RecipeCard;

beforeEach(() => {
  featureFlags.values.clear();
  featureFlags.values.set("sloe_v3_discover_editorial", true);
  featureFlags.values.set("discover_photographic_first_view_v1", true);
  discoverRecipeImage.mockClear();
});

describe("DiscoverQuickWeeknight (web)", () => {
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
          rc("Slow stew", { prepTimeMin: 20, cookTimeMin: 40 }),
        ]}
        onPressRecipe={onPressRecipe}
      />,
    );
    expect(getByText("Quick weeknight")).toBeTruthy();
    expect(getByText("360 kcal · 22g · 7 min")).toBeTruthy();
    expect(getByTestId("quick-weeknight-photo-Egg wrap")).toBeTruthy();
    expect(discoverRecipeImage).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "https://example.com/egg-wrap.jpg",
        id: "Egg wrap",
      }),
    );
    fireEvent.click(getByLabelText(/Egg wrap/));
    expect(onPressRecipe).toHaveBeenCalledTimes(1);
  });

  it("restores the legacy tint card when the photographic flag is off", () => {
    featureFlags.values.set("discover_photographic_first_view_v1", false);
    const { getByTestId, queryByTestId } = render(
      <DiscoverQuickWeeknight recipes={[rc("Egg wrap")]} onPressRecipe={() => {}} />,
    );

    expect(getByTestId("quick-weeknight-tint-Egg wrap")).toBeTruthy();
    expect(queryByTestId("quick-weeknight-photo-Egg wrap")).toBeNull();
    expect(discoverRecipeImage).not.toHaveBeenCalled();
  });

  it("renders nothing with no quick recipes", () => {
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

describe("DiscoverQuickWeeknight (web) — ENG-1503 page inset", () => {
  it("the section carries the standard < md page inset (px-4 md:px-0), matching sibling Discover sections", () => {
    const { container } = render(
      <DiscoverQuickWeeknight recipes={[rc("Egg wrap")]} onPressRecipe={() => {}} />,
    );
    const section = container.querySelector("section");
    expect(section?.className).toContain("px-4");
    expect(section?.className).toContain("md:px-0");
  });
});
