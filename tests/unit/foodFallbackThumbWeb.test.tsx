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
import { fireEvent, render } from "@testing-library/react";
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

  it("keeps the correct sample for a photo-confident dish hit (breakfast-bowl)", () => {
    const { container } = render(<FoodFallbackThumb title="Berry breakfast bowl" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      "/imagery/fallbacks/samples/berry-breakfast-bowl.png",
    );
  });

  it("photo-confidence split: ambiguous keyword hits keep the category tint but NEVER render the sample photo", () => {
    // Refuter blockers — each resolves a shipped-sample category, but
    // the shipped photo is not that dish ("zucchini noodles" is not the
    // tonkotsu ramen photo). Glyph + tint is the honest render.
    for (const title of [
      "Zucchini noodles",
      "Protein shake",
      "Greek yogurt bowl",
      "Greek salad",
      "Spaghetti bolognese",
      "Grilled chicken breast",
    ]) {
      const { container } = render(<FoodFallbackThumb title={title} />);
      expect(
        container.querySelector('[data-testid="food-fallback-glyph"]'),
        title,
      ).toBeTruthy();
      expect(container.querySelector("img"), title).toBeNull();
    }
  });

  it("degrades photo → sample → glyph on load errors (a 404 sample never leaves a glyphless disc)", () => {
    const { container, getByTestId } = render(
      <FoodFallbackThumb title="Tonkotsu ramen" imageUrl="https://example.com/broken.png" />,
    );
    let img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://example.com/broken.png");
    fireEvent.error(img);
    img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("/imagery/fallbacks/samples/ramen-bowl.png");
    fireEvent.error(img);
    expect(container.querySelector("img")).toBeNull();
    expect(getByTestId("food-fallback-glyph")).toBeTruthy();
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
      render(<FoodFallbackThumb title="Green salad" />).getByTestId("food-fallback-salad"),
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
