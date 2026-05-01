/**
 * 2026-04-30 ui-product-designer recipe-detail audit — pure-function
 * tests for the layout helpers that drive the redesigned hero stack.
 * The mobile and web detail screens both consume these helpers via
 * `apps/mobile/lib/recipe/recipeDetailLayout.ts` (re-export) and
 * `src/lib/recipe/recipeDetailLayout.ts` (source of truth).
 *
 * If these tests fail the redesign has regressed:
 *   - hidden time-stats row reappears on a recipe with no timings
 *   - subtitle composition orders / gates change
 */
import { describe, expect, it } from "vitest";

import {
  composeSubtitleParts,
  shouldRenderTimeStats,
} from "../../lib/recipe/recipeDetailLayout";

describe("shouldRenderTimeStats", () => {
  it("returns false when both prep and cook are null", () => {
    expect(shouldRenderTimeStats(null, null)).toBe(false);
    expect(shouldRenderTimeStats(undefined, undefined)).toBe(false);
    // Zero is treated the same as missing — a 0 min cook is noise.
    expect(shouldRenderTimeStats(0, 0)).toBe(false);
  });

  it("returns true when prep is known and cook is missing", () => {
    expect(shouldRenderTimeStats(10, null)).toBe(true);
    expect(shouldRenderTimeStats(10, undefined)).toBe(true);
    expect(shouldRenderTimeStats(10, 0)).toBe(true);
  });

  it("returns true when cook is known and prep is missing", () => {
    expect(shouldRenderTimeStats(null, 25)).toBe(true);
    expect(shouldRenderTimeStats(undefined, 25)).toBe(true);
    expect(shouldRenderTimeStats(0, 25)).toBe(true);
  });
});

describe("composeSubtitleParts", () => {
  it("composes [by, slot, serves] in order when all three are present", () => {
    const parts = composeSubtitleParts({
      authorLabel: "emthenutritionist",
      slots: ["Lunch"],
      servings: 3,
    });
    expect(parts.map((p) => p.key)).toEqual(["by", "slot", "serves"]);
    expect(parts[0].label).toBe("by emthenutritionist");
    // Slot label is lowercased and joined with `, ` so we can render
    // a single `· lunch ·` token in the subtitle row.
    expect(parts[1].label).toBe("lunch");
    expect(parts[2].label).toBe("serves 3");
  });

  it("returns [serves] only when author and slots are absent", () => {
    const parts = composeSubtitleParts({
      authorLabel: null,
      slots: null,
      servings: 4,
    });
    expect(parts.map((p) => p.key)).toEqual(["serves"]);
    expect(parts[0].label).toBe("serves 4");
  });

  it("drops the slot part when slots is an empty array (no orphan separator)", () => {
    const parts = composeSubtitleParts({
      authorLabel: "Grace",
      slots: [],
      servings: 2,
    });
    expect(parts.map((p) => p.key)).toEqual(["by", "serves"]);
  });

  it("joins multiple slots and lowercases them", () => {
    const parts = composeSubtitleParts({
      authorLabel: null,
      slots: ["Lunch", "Dinner"],
      servings: 2,
    });
    expect(parts[0].label).toBe("lunch, dinner");
  });

  it("drops servings when zero (no `serves 0` rendered)", () => {
    const parts = composeSubtitleParts({
      authorLabel: "Grace",
      slots: null,
      servings: 0,
    });
    expect(parts.map((p) => p.key)).toEqual(["by"]);
  });
});
