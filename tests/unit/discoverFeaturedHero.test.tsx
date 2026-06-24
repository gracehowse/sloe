// @vitest-environment jsdom
/**
 * DiscoverFeaturedHero (ENG-1225 #14) — the v3 web Discover featured block.
 * Two layers:
 *  - `DiscoverFeaturedHeroCard` (presentation): renders the serif title + the
 *    kcal/protein/min triad, taps through to the recipe + creator.
 *  - `DiscoverFeaturedHero` (self-gating host entry): renders the card ONLY when
 *    `discover_creator_rail_v1` is on, the view is the default unfiltered one,
 *    and a recipe exists — otherwise nothing.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const isFeatureEnabled = vi.fn(() => true);
vi.mock("../../src/lib/analytics/track", () => ({
  isFeatureEnabled: (flag: string) => isFeatureEnabled(flag),
}));

import {
  DiscoverFeaturedHero,
  DiscoverFeaturedHeroCard,
} from "../../src/app/components/suppr/discover-featured-hero";
import type { RecipeCard } from "../../src/types/recipe";

void React;

afterEach(() => isFeatureEnabled.mockReset());

const recipe = {
  id: "r1",
  creatorName: "Priya Patel",
  creatorImage: "",
  title: "Harissa chickpea stew",
  image: "https://images.unsplash.com/x.jpg",
  servings: 4,
  calories: 540,
  protein: 31,
  carbs: 48,
  fat: 22,
  isVerified: false,
  savedCount: 0,
  isSaved: false,
  cookTimeMin: 35,
  creatorId: "seed-creator-priya",
} as RecipeCard;

describe("DiscoverFeaturedHeroCard (presentation)", () => {
  it("renders the serif title + the kcal/protein/min metric triad", () => {
    const { getByText, getByTestId } = render(
      <DiscoverFeaturedHeroCard recipe={recipe} onOpenRecipe={() => {}} />,
    );
    expect(getByTestId("discover-featured-hero")).not.toBeNull();
    expect(getByText("Harissa chickpea stew")).not.toBeNull();
    expect(getByText("540")).not.toBeNull();
    expect(getByText("31g")).not.toBeNull();
    expect(getByText("35")).not.toBeNull();
    expect(getByText("Trending this week")).not.toBeNull();
  });

  it("opens the recipe when the stretched card action is activated", () => {
    // a11y (ENG-1225 #14): the card is a non-interactive container with a
    // stretched <button> primary action (no nested-interactive). Activate that.
    const onOpenRecipe = vi.fn();
    const { getByRole } = render(
      <DiscoverFeaturedHeroCard recipe={recipe} onOpenRecipe={onOpenRecipe} />,
    );
    fireEvent.click(getByRole("button", { name: /open recipe/i }));
    expect(onOpenRecipe).toHaveBeenCalledWith(recipe);
  });

  it("taps the byline through to the creator when one is linked", () => {
    const onOpenCreator = vi.fn();
    const { getByText } = render(
      <DiscoverFeaturedHeroCard recipe={recipe} onOpenRecipe={() => {}} onOpenCreator={onOpenCreator} />,
    );
    fireEvent.click(getByText("Priya Patel"));
    expect(onOpenCreator).toHaveBeenCalledWith("seed-creator-priya");
  });

  it("omits the Min metric + creator link when there's no cook time / creator", () => {
    const bare = { ...recipe, cookTimeMin: null, cookTime: undefined, creatorId: null } as RecipeCard;
    const onOpenCreator = vi.fn();
    const { queryByText, getByText } = render(
      <DiscoverFeaturedHeroCard recipe={bare} onOpenRecipe={() => {}} onOpenCreator={onOpenCreator} />,
    );
    expect(queryByText("Min")).toBeNull();
    fireEvent.click(getByText("Priya Patel"));
    expect(onOpenCreator).not.toHaveBeenCalled();
  });
});

describe("DiscoverFeaturedHero (self-gating host entry)", () => {
  it("renders the card when the flag is on + default view + a recipe exists", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { getByTestId } = render(
      <DiscoverFeaturedHero recipes={[recipe]} defaultView onOpenRecipe={() => {}} />,
    );
    expect(getByTestId("discover-featured-hero")).not.toBeNull();
  });

  it("renders nothing when the flag is off", () => {
    isFeatureEnabled.mockReturnValue(false);
    const { queryByTestId } = render(
      <DiscoverFeaturedHero recipes={[recipe]} defaultView onOpenRecipe={() => {}} />,
    );
    expect(queryByTestId("discover-featured-hero")).toBeNull();
  });

  it("renders nothing when the view is narrowed (not the default view)", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { queryByTestId } = render(
      <DiscoverFeaturedHero recipes={[recipe]} defaultView={false} onOpenRecipe={() => {}} />,
    );
    expect(queryByTestId("discover-featured-hero")).toBeNull();
  });

  it("renders nothing when there are no recipes", () => {
    isFeatureEnabled.mockReturnValue(true);
    const { queryByTestId } = render(
      <DiscoverFeaturedHero recipes={[]} defaultView onOpenRecipe={() => {}} />,
    );
    expect(queryByTestId("discover-featured-hero")).toBeNull();
  });

  it("prefers a photo-bearing recipe as the feature", () => {
    isFeatureEnabled.mockReturnValue(true);
    const noPhoto = { ...recipe, id: "np", title: "No photo", image: "" } as RecipeCard;
    const { getByText } = render(
      <DiscoverFeaturedHero recipes={[noPhoto, recipe]} defaultView onOpenRecipe={() => {}} />,
    );
    expect(getByText("Harissa chickpea stew")).not.toBeNull();
  });
});
