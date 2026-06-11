import { describe, expect, it } from "vitest";
import {
  fnv1a32,
  normalizeFoodTitle,
  resolveFoodFallbackCategory,
  resolveFoodFallbackSampleCategory,
} from "../../src/lib/imagery/foodFallbackCategory";

describe("foodFallbackCategory (ENG-1015)", () => {
  it("normalizes titles for stable matching", () => {
    expect(normalizeFoodTitle("  Chicken & Rice!!! ")).toBe("chicken rice");
  });

  it("resolves keyword categories from title", () => {
    expect(resolveFoodFallbackCategory({ title: "Tonkotsu ramen bowl" })).toBe(
      "ramen-noodles",
    );
    expect(resolveFoodFallbackCategory({ title: "Greek salad" })).toBe("salad");
    expect(resolveFoodFallbackCategory({ title: "Berry smoothie" })).toBe(
      "smoothie",
    );
  });

  it("falls back to slot defaults when title is empty", () => {
    expect(
      resolveFoodFallbackCategory({ title: "", slot: "Breakfast" }),
    ).toBe("breakfast-bowl");
    expect(resolveFoodFallbackCategory({ title: "", slot: "Dinner" })).toBe(
      "rice-bowl",
    );
  });

  it("maps unknown categories to a shipped sample deterministically", () => {
    const sample = resolveFoodFallbackSampleCategory("curry");
    expect(["ramen-noodles", "breakfast-bowl", "chicken", "salad", "pasta", "smoothie"]).toContain(
      sample,
    );
    expect(resolveFoodFallbackSampleCategory("curry")).toBe(
      resolveFoodFallbackSampleCategory("curry"),
    );
  });

  it("fnv1a32 is stable for the same input", () => {
    expect(fnv1a32("chicken")).toBe(fnv1a32("chicken"));
    expect(fnv1a32("chicken")).not.toBe(fnv1a32("beef"));
  });
});
