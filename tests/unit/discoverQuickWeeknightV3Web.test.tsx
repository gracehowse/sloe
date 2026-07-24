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
  // Mirrors the real registry — `design_consistency_v1` is in
  // REDESIGN_DEFAULT_ON (src/lib/analytics/track.ts).
  featureFlags.values.set("design_consistency_v1", true);
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
    // `design_consistency_v1` (default-ON) labels the protein figure — it was
    // the only unlabelled datum in a recipe meta line — so the card now reads
    // the same shape as `RecipeCardWide` / `FeaturedHero`.
    expect(getByText("360 kcal · 22g protein · 7 min")).toBeTruthy();
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

  /**
   * Design-consistency pass (2026-07-24): the cook time used to be printed
   * twice on this card — a pill on the photo AND the meta line ~60px below —
   * and the protein figure was the only unlabelled datum in any recipe meta
   * line in the product. The pill is gone and the macro is labelled; the
   * kill switch restores both.
   */
  it("prints the cook time once — the meta line, not a pill on the photo", () => {
    const { queryByText, getByText } = render(
      <DiscoverQuickWeeknight
        recipes={[
          rc("Egg wrap", { calories: 360, protein: 22, prepTimeMin: 3, cookTimeMin: 4 }),
        ]}
        onPressRecipe={() => {}}
      />,
    );
    expect(getByText("360 kcal · 22g protein · 7 min")).toBeTruthy();
    // The pill rendered "7 min" as its own text node; nothing else on the card
    // does, so its absence is the assertion.
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
