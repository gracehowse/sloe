/**
 * Audit 2026-05-04 #28 — `<RecipeCardImage>` on-error fallback test.
 * ENG-1015 — painterly `FoodFallbackThumb` when id/title are available.
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Image, View } from "react-native";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react-native", () => ({
  UtensilsCrossed: ({ testID }: { testID?: string }) => (
    <View testID={testID ?? "utensils-crossed-glyph"} />
  ),
  Utensils: () => <View />,
}));

vi.mock("../../components/imagery/FoodFallbackThumb", () => ({
  FoodFallbackThumb: ({ testID }: { testID?: string }) => (
    <View testID={testID ?? "food-fallback-thumb"} />
  ),
}));

import { RecipeCardImage } from "../../components/library/RecipeCardImage";

describe("Library <RecipeCardImage> — on-error placeholder (audit #28)", () => {
  const cardImageStyle = { width: 100, height: 100 };

  it("renders the network image when no error", () => {
    const { UNSAFE_getByType, queryByTestId } = render(
      <RecipeCardImage
        uri="https://example.test/recipe.jpg"
        cardImageStyle={cardImageStyle}
        fallbackBg="#eee"
        fallbackTint="#888"
      />,
    );
    expect(UNSAFE_getByType(Image)).toBeTruthy();
    expect(queryByTestId("utensils-crossed-glyph")).toBeNull();
  });

  it("renders the placeholder glyph when uri is null", () => {
    const { UNSAFE_queryByType, getByTestId } = render(
      <RecipeCardImage
        uri={null}
        cardImageStyle={cardImageStyle}
        fallbackBg="#eee"
        fallbackTint="#888"
      />,
    );
    expect(UNSAFE_queryByType(Image)).toBeNull();
    expect(getByTestId("utensils-crossed-glyph")).toBeTruthy();
  });

  it("renders FoodFallbackThumb when uri is null AND id/title are passed (ENG-1015)", () => {
    const { UNSAFE_queryByType, getByTestId, queryByTestId } = render(
      <RecipeCardImage
        uri={null}
        cardImageStyle={cardImageStyle}
        fallbackBg="#eee"
        fallbackTint="#888"
        recipeId="abc-123"
        recipeTitle="Roast tomato soup"
      />,
    );
    expect(UNSAFE_queryByType(Image)).toBeNull();
    expect(getByTestId("recipe-card-image-fallback-abc-123")).toBeTruthy();
    expect(getByTestId("recipe-card-food-fallback-abc-123")).toBeTruthy();
    expect(queryByTestId("utensils-crossed-glyph")).toBeNull();
  });

  it("swaps to the placeholder glyph when the image fires onError", () => {
    const { UNSAFE_getByType, queryByTestId, getByTestId, UNSAFE_queryByType } = render(
      <RecipeCardImage
        uri="https://example.test/broken.jpg"
        cardImageStyle={cardImageStyle}
        fallbackBg="#eee"
        fallbackTint="#888"
      />,
    );
    expect(UNSAFE_getByType(Image)).toBeTruthy();
    expect(queryByTestId("utensils-crossed-glyph")).toBeNull();
    fireEvent(UNSAFE_getByType(Image), "error");
    expect(UNSAFE_queryByType(Image)).toBeNull();
    expect(getByTestId("utensils-crossed-glyph")).toBeTruthy();
  });
});
