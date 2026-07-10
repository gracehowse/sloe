// @vitest-environment jsdom
/**
 * Web FoodFallbackThumb — honest-imagery contract (ENG-1478).
 *
 * The shared resolver returns `null` for categories without a shipped
 * sample asset; the thumb must then render the utensil glyph — never a
 * hash-picked WRONG sample (the captured bug: "Salmon, potatoes & greens"
 * → fish → berry-smoothie image). Shipped categories keep their sample.
 *
 * Mobile parity: same contract verified live on the sim (ENG-1478 capture
 * set) + pinned by tests/unit/foodFallbackCategory.test.ts at the resolver.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FoodFallbackThumb } from "../../src/app/components/suppr/food-fallback-thumb";

void React;

describe("FoodFallbackThumb (web) — ENG-1478", () => {
  it("renders the honest glyph for an unshipped category (fish), never a wrong sample", () => {
    const { getByTestId, container } = render(
      <FoodFallbackThumb title="PERSONA: Salmon, potatoes & greens" />,
    );
    expect(getByTestId("food-fallback-glyph")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps the correct sample for a shipped category (breakfast-bowl)", () => {
    const { container } = render(
      <FoodFallbackThumb title="Greek yogurt, oats & berries" />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      "/imagery/fallbacks/samples/berry-breakfast-bowl.png",
    );
  });

  it("prefers a real imageUrl over any fallback", () => {
    const { container } = render(
      <FoodFallbackThumb title="Anything" imageUrl="https://example.com/x.png" />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/x.png",
    );
  });
});
