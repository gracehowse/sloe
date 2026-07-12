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
import { HERO_TINTS_DARK, recipeUnderlayColor } from "@suppr/shared/recipe/recipeHeroFallback";

// ENG-1528 — RecipeCardImage now resolves the underlay per scheme via
// `useResolvedScheme()`. With no ThemeProvider mounted, that falls back to the
// RN shim's `useColorScheme()`, which returns "dark" (tests/shims/react-native.cjs),
// so these render assertions pin the DARK-ramp tint. The light-path byte-identity
// is covered by the pure-function suite (tests/unit/recipeHeroFallback.test.ts).
const TEST_SCHEME = "dark" as const;

describe("Library <RecipeCardImage> — honest imagery fallback (ENG-1287)", () => {
  const cardImageStyle = { width: 100, height: 100 };

  it("renders the network image when a real URL loads cleanly", () => {
    const { UNSAFE_getByType, queryByTestId } = render(
      <RecipeCardImage
        uri="https://example.test/recipe.jpg"
        cardImageStyle={cardImageStyle}
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
            recipeId="grid-1"
          recipeTitle="Grid card"
        />,
      );
      const wrapper = getByTestId("recipe-card-image-fallback-grid-1");
      const flattened = StyleSheet.flatten(wrapper.props.style);
      expect(flattened.position).toBe("relative");
    });

    it("ENG-1374 PR 2: paints the recipe's own opaque §11.4 cuisine tint on the wrapper itself — a structural guarantee against blank white no caller can override", () => {
      const { getByTestId } = render(
        <RecipeCardImage
          uri={null}
          cardImageStyle={StyleSheet.absoluteFillObject}
          recipeId="hero-2"
          recipeTitle="Roast tomato pasta"
        />,
      );
      const wrapper = getByTestId("recipe-card-image-fallback-hero-2");
      const flattened = StyleSheet.flatten(wrapper.props.style);
      // "pasta" → warms bucket → dark-ramp warms (test env resolves dark); opaque hex.
      expect(flattened.backgroundColor).toBe(
        recipeUnderlayColor({ id: "hero-2", title: "Roast tomato pasta" }, TEST_SCHEME),
      );
      expect(flattened.backgroundColor).toBe(HERO_TINTS_DARK.warms);
      expect(flattened.backgroundColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it("ENG-1374 PR 2: the photo branch carries the same opaque tint on the image element itself (never-white while a real URL streams in, flag-off path included)", () => {
      const { UNSAFE_getByType } = render(
        <RecipeCardImage
          uri="https://example.test/recipe.jpg"
          cardImageStyle={cardImageStyle}
          recipeId="hero-3"
          recipeTitle="Green salad"
        />,
      );
      const img = UNSAFE_getByType(Image);
      const flattened = StyleSheet.flatten(img.props.style);
      expect(flattened.backgroundColor).toBe(HERO_TINTS_DARK.greens);
    });
  });
});
