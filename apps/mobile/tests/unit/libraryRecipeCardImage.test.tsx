/**
 * Audit 2026-05-04 #28 — `<RecipeCardImage>` fallback behaviour.
 * ENG-1287 (honest imagery) — a recipe with no image renders the
 * deterministic `RecipeHeroFallback` (never a substituted stock photo);
 * the same fallback fires when a real image URL errors at load.
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Image, StyleSheet, View } from "react-native";
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

  describe("ENG-1382 — absolute-fill cardImageStyle must not collapse the fallback", () => {
    it("preserves position:'absolute' when cardImageStyle is StyleSheet.absoluteFillObject (FeaturedHero's usage)", () => {
      // Regression: the fallback wrapper used to append
      // `{ position: "relative" }` unconditionally after the caller's
      // style in the array, which clobbered an incoming
      // `position: "absolute"` (RN style arrays merge left-to-right,
      // last write wins) and collapsed the fallback to zero size inside
      // FeaturedHero's photo slot.
      const { getByTestId } = render(
        <RecipeCardImage
          uri={null}
          cardImageStyle={StyleSheet.absoluteFillObject}
          fallbackBg="#eee"
          recipeId="hero-1"
          recipeTitle="Tonight's pick"
        />,
      );
      const wrapper = getByTestId("recipe-card-image-fallback-hero-1");
      const flattened = StyleSheet.flatten(wrapper.props.style);
      expect(flattened.position).toBe("absolute");
      expect(flattened.top).toBe(0);
      expect(flattened.bottom).toBe(0);
    });

    it("still defaults to position:'relative' for a plain width/height cardImageStyle (the other consumers' usage)", () => {
      const { getByTestId } = render(
        <RecipeCardImage
          uri={null}
          cardImageStyle={cardImageStyle}
          fallbackBg="#eee"
          recipeId="grid-1"
          recipeTitle="Grid card"
        />,
      );
      const wrapper = getByTestId("recipe-card-image-fallback-grid-1");
      const flattened = StyleSheet.flatten(wrapper.props.style);
      expect(flattened.position).toBe("relative");
    });

    it("ENG-1374: paints fallbackBg on the wrapper itself as a structural guarantee against blank white", () => {
      const { getByTestId } = render(
        <RecipeCardImage
          uri={null}
          cardImageStyle={StyleSheet.absoluteFillObject}
          fallbackBg="#3B2A4D"
          recipeId="hero-2"
          recipeTitle="Tonight's pick"
        />,
      );
      const wrapper = getByTestId("recipe-card-image-fallback-hero-2");
      const flattened = StyleSheet.flatten(wrapper.props.style);
      expect(flattened.backgroundColor).toBe("#3B2A4D");
    });
  });
});
