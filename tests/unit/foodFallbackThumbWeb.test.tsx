// @vitest-environment jsdom
/**
 * Web FoodFallbackThumb — honest-imagery contract (ENG-1478, tiered
 * per ENG-1448 PR 1).
 *
 * The shared resolver returns a tiered resolution; the thumb renders a
 * sample image ONLY when the tier is a confident 'category' hit with a
 * shipped asset — never a hash-picked WRONG sample (the captured bug:
 * "Salmon, potatoes & greens" → fish → berry-smoothie image). Every
 * render sits on an opaque §11.4 tint underlay so no child failure can
 * expose white.
 *
 * Mobile parity: apps/mobile/tests/unit/foodFallbackThumbMobile.test.ts
 * pins the same contract at the source level + the shared resolver.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { FoodFallbackThumb } from "../../src/app/components/suppr/food-fallback-thumb";

void React;

describe("FoodFallbackThumb (web) — ENG-1478 / ENG-1448", () => {
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

  it("never-white: the wrapper carries an opaque tint underlay on every tier", () => {
    for (const el of [
      render(<FoodFallbackThumb title="Greek salad" />).getByTestId("food-fallback-salad"),
      render(<FoodFallbackThumb title="Mystery meal" />).getByTestId("food-fallback-glyph"),
      render(
        <FoodFallbackThumb title="Anything" imageUrl="https://example.com/x.png" testId="photo" />,
      ).getByTestId("photo"),
    ]) {
      expect((el as HTMLElement).style.backgroundColor).not.toBe("");
    }
  });

  it("slot tier: an unmatched title with a slot renders the slot glyph + tint, no image", () => {
    const { getByTestId, container } = render(
      <FoodFallbackThumb title="Grace's usual" slot="Breakfast" />,
    );
    const el = getByTestId("food-fallback-glyph") as HTMLElement;
    expect(container.querySelector("img")).toBeNull();
    // Breakfast slot tint = ambers (rgb of #EFE4CE) — jsdom normalises to rgb().
    expect(el.style.backgroundColor).toBe("rgb(239, 228, 206)");
  });
});
