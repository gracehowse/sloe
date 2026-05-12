/**
 * Audit 2026-05-04 #28 — `<RecipeCardImage>` on-error fallback test.
 *
 * `pickDefaultImage` upstream means `item.image` is always a string,
 * so the broken-image case in the wild is "<Image source={uri}>" failing
 * to load (network blip / expired Unsplash URL / 404). The component
 * must swap to the placeholder surface (utensils glyph on a soft-grey
 * background) when `onError` fires, so a single broken image doesn't
 * leave a stark white rectangle next to siblings that loaded cleanly.
 */
import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { Image, View } from "react-native";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react-native", () => ({
  UtensilsCrossed: ({ testID }: { testID?: string }) => (
    <View testID={testID ?? "utensils-crossed-glyph"} />
  ),
  // B7 (2026-05-11) — glyph set used by `<RecipeHeroFallback>`. Tested
  // separately; here we just need them to render as Views so the
  // per-recipe placeholder mounts without RN-svg errors.
  Salad: () => <View />,
  Beef: () => <View />,
  Fish: () => <View />,
  Pizza: () => <View />,
  Cookie: () => <View />,
  Soup: () => <View />,
  Wheat: () => <View />,
  Utensils: () => <View />,
}));

vi.mock("react-native-svg", () => {
  const fn = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    __esModule: true,
    default: fn,
    Defs: fn,
    LinearGradient: fn,
    Pattern: fn,
    Rect: fn,
    Stop: fn,
    Circle: fn,
    Path: fn,
    G: fn,
  };
});

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

  it("renders the per-recipe RecipeHeroFallback when uri is null AND id/title are passed (B7 2026-05-11)", () => {
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
    // Per-recipe placeholder wrapper carries the recipe id so the
    // gradient seed is observable from outside the component.
    expect(getByTestId("recipe-card-image-fallback-abc-123")).toBeTruthy();
    // The legacy utensils glyph is the WRONG fallback when id/title
    // are available — it would mean the per-recipe placeholder didn't
    // mount. Pin that explicitly.
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
