/**
 * Audit 2026-05-04 #28 — `<RecipeCardImage>` fallback behaviour.
 * ENG-1287 (honest imagery) — a recipe with no image renders the
 * deterministic `RecipeHeroFallback` (never a substituted stock photo);
 * the same fallback fires when a real image URL errors at load.
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Image, View } from "react-native";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../components/RecipeHeroFallback", () => ({
  RecipeHeroFallback: ({ id }: { id: string }) => (
    <View testID={`recipe-hero-fallback-${id}`} />
  ),
}));

import { RecipeCardImage } from "../../components/library/RecipeCardImage";

describe("Library <RecipeCardImage> — honest imagery fallback (ENG-1287)", () => {
  const cardImageStyle = { width: 100, height: 100 };

  it("renders the network image when a real URL loads cleanly", () => {
    const { UNSAFE_getByType, queryByTestId } = render(
      <RecipeCardImage
        uri="https://example.test/recipe.jpg"
        cardImageStyle={cardImageStyle}
        fallbackBg="#eee"
        recipeId="abc-123"
        recipeTitle="Roast tomato soup"
      />,
    );
    expect(UNSAFE_getByType(Image)).toBeTruthy();
    expect(queryByTestId("recipe-hero-fallback-abc-123")).toBeNull();
  });

  it("renders RecipeHeroFallback when uri is null — never a stock photo", () => {
    const { UNSAFE_queryByType, getByTestId } = render(
      <RecipeCardImage
        uri={null}
        cardImageStyle={cardImageStyle}
        fallbackBg="#eee"
        recipeId="abc-123"
        recipeTitle="Roast tomato soup"
      />,
    );
    expect(UNSAFE_queryByType(Image)).toBeNull();
    expect(getByTestId("recipe-card-image-fallback-abc-123")).toBeTruthy();
    expect(getByTestId("recipe-hero-fallback-abc-123")).toBeTruthy();
  });

  it("swaps to RecipeHeroFallback when the image fires onError", () => {
    const { UNSAFE_getByType, UNSAFE_queryByType, getByTestId, queryByTestId } = render(
      <RecipeCardImage
        uri="https://example.test/broken.jpg"
        cardImageStyle={cardImageStyle}
        fallbackBg="#eee"
        recipeId="abc-123"
        recipeTitle="Roast tomato soup"
      />,
    );
    expect(queryByTestId("recipe-hero-fallback-abc-123")).toBeNull();
    fireEvent(UNSAFE_getByType(Image), "error");
    expect(UNSAFE_queryByType(Image)).toBeNull();
    expect(getByTestId("recipe-hero-fallback-abc-123")).toBeTruthy();
  });
});
