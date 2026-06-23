/**
 * DiscoverCollections web (ENG-1225 Block 6) — the v3 Discover gradient-tile
 * collections that deep-link into category pills, web twin. Mirrors
 * `apps/mobile/tests/unit/discoverCollectionsV3.test.tsx`: pins flag/empty
 * gating, the live count, the labels, and the onSelectCategory wiring.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

const isFeatureEnabled = vi.fn(() => true);
vi.mock("../../src/lib/analytics/track", () => ({
  isFeatureEnabled: () => isFeatureEnabled(),
}));

import { DiscoverCollections } from "../../src/app/components/suppr/discover-collections";
import type { RecipeCard } from "../../src/types/recipe";

const rc = (id: string, o: Partial<RecipeCard> = {}): RecipeCard =>
  ({
    id,
    title: id,
    calories: 500,
    protein: 40, // high protein
    carbs: 40,
    fat: 12,
    prepTimeMin: 5,
    cookTimeMin: 10, // quick
    ...o,
  }) as RecipeCard;

describe("DiscoverCollections (web)", () => {
  it("renders tiles with live counts and fires onSelectCategory", () => {
    const onSelectCategory = vi.fn();
    const recipes = [rc("a"), rc("b"), rc("c")]; // all qualify for both
    const { getByText, getByLabelText } = render(
      <DiscoverCollections recipes={recipes} onSelectCategory={onSelectCategory} />,
    );
    expect(getByText("Collections")).toBeTruthy();
    expect(getByText("High-protein dinners")).toBeTruthy();
    expect(getByText("Under 30 minutes")).toBeTruthy();
    expect(getByLabelText(/High-protein dinners, 3 recipes/)).toBeTruthy();
    fireEvent.click(getByLabelText(/Under 30 minutes/));
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
