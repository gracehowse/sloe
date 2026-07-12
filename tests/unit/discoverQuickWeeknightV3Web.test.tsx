/**
 * DiscoverQuickWeeknight web (ENG-1225 Block 6) — the v3 Discover "Quick
 * weeknight" section, web twin. Pins the flag + empty gating, the meta line, and
 * the onPress wiring.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

const isFeatureEnabled = vi.fn(() => true);
vi.mock("../../src/lib/analytics/track", () => ({
  isFeatureEnabled: () => isFeatureEnabled(),
}));

import { DiscoverQuickWeeknight } from "../../src/app/components/suppr/discover-quick-weeknight";
import type { RecipeCard } from "../../src/types/recipe";

const rc = (id: string, o: Partial<RecipeCard> = {}): RecipeCard =>
  ({
    id,
    title: id,
    calories: 420,
    protein: 28,
    carbs: 40,
    fat: 12,
    prepTimeMin: 8,
    cookTimeMin: 12,
    ...o,
  }) as RecipeCard;

describe("DiscoverQuickWeeknight (web)", () => {
  it("renders quick recipes with meta + fires onPress", () => {
    const onPressRecipe = vi.fn();
    const { getByText, getByLabelText } = render(
      <DiscoverQuickWeeknight
        recipes={[
          rc("Egg wrap", { calories: 360, protein: 22, prepTimeMin: 3, cookTimeMin: 4 }),
          rc("Slow stew", { prepTimeMin: 20, cookTimeMin: 40 }),
        ]}
        onPressRecipe={onPressRecipe}
      />,
    );
    expect(getByText("Quick weeknight")).toBeTruthy();
    expect(getByText("360 kcal · 22g · 7 min")).toBeTruthy();
    fireEvent.click(getByLabelText(/Egg wrap/));
    expect(onPressRecipe).toHaveBeenCalledTimes(1);
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
    isFeatureEnabled.mockReturnValueOnce(false);
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
