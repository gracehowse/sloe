/**
 * F-91 (2026-04-25) — pin name-based natural-serving inference.
 *
 * Tester re-verified after F-87/F-88: search rows for "Eggs, Grade A,
 * Large, egg whole" / "Bananas, raw" / "Apples, raw, with skin" still
 * displayed "per 100g" instead of "1 large egg (50 g) · 72 kcal".
 *
 * Root cause: USDA's `/foods/search` endpoint does not ship
 * `foodPortions[]` for Foundation / SR Legacy hits, so our
 * `pickUsdaFoodPortionsPrimaryServing` returned null on the search row,
 * and the display layer fell back to per-100g. F-88 fixed the picker
 * (post-tap) by fetching `/food/{id}` for foodPortions; F-91 handles
 * the search row itself by mapping verified USDA descriptions to a
 * known natural serving via pattern match.
 */
import { describe, expect, it } from "vitest";
import { inferNaturalServingFromName } from "@/lib/nutrition/inferNaturalServing";

const EGG_WHOLE_PER_100G = { calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 };
const BANANA_PER_100G = { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 };
const APPLE_PER_100G = { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 };

describe("inferNaturalServingFromName", () => {
  it("infers '1 large egg' (50g) from 'Eggs, Grade A, Large, egg whole'", () => {
    const ps = inferNaturalServingFromName("Eggs, Grade A, Large, egg whole", EGG_WHOLE_PER_100G, true);
    expect(ps).not.toBeNull();
    expect(ps!.label).toBe("1 large egg");
    expect(ps!.grams).toBe(50);
    // 143 * 0.5 = 71.5 → rounds to 72
    expect(ps!.kcal).toBe(72);
  });

  it("infers '1 large egg white' (33g) from 'Eggs, Grade A, Large, egg white'", () => {
    const eggWhitePer100g = { calories: 52, protein: 10.9, carbs: 0.7, fat: 0.2 };
    const ps = inferNaturalServingFromName("Eggs, Grade A, Large, egg white", eggWhitePer100g, true);
    expect(ps!.label).toBe("1 large egg white");
    expect(ps!.grams).toBe(33);
  });

  it("infers '1 large egg yolk' (17g) from 'Eggs, Grade A, Large, egg yolk'", () => {
    const eggYolkPer100g = { calories: 322, protein: 16.4, carbs: 1.8, fat: 26.5 };
    const ps = inferNaturalServingFromName("Eggs, Grade A, Large, egg yolk", eggYolkPer100g, true);
    expect(ps!.label).toBe("1 large egg yolk");
    expect(ps!.grams).toBe(17);
  });

  it("infers '1 medium banana' (118g) from 'Bananas, raw'", () => {
    const ps = inferNaturalServingFromName("Bananas, raw", BANANA_PER_100G, true);
    expect(ps!.label).toBe("1 medium banana");
    expect(ps!.grams).toBe(118);
    // 89 * 1.18 = 105.02 → 105
    expect(ps!.kcal).toBe(105);
  });

  it("infers '1 medium apple' (182g) from 'Apples, raw, with skin'", () => {
    const ps = inferNaturalServingFromName("Apples, raw, with skin", APPLE_PER_100G, true);
    expect(ps!.label).toBe("1 medium apple");
    expect(ps!.grams).toBe(182);
  });

  it("returns null when not verified — branded rows must use their own servingSize, not name inference", () => {
    expect(inferNaturalServingFromName("EGGS", EGG_WHOLE_PER_100G, false)).toBeNull();
    expect(inferNaturalServingFromName("Eggs, Grade A, Large, egg whole", EGG_WHOLE_PER_100G, false)).toBeNull();
  });

  it("returns null for ambiguous descriptions ('Egg' alone, no qualifier)", () => {
    expect(inferNaturalServingFromName("Egg", EGG_WHOLE_PER_100G, true)).toBeNull();
    expect(inferNaturalServingFromName("Eggs", EGG_WHOLE_PER_100G, true)).toBeNull();
  });

  it("returns null for unrelated descriptions", () => {
    expect(inferNaturalServingFromName("Bagels, egg", EGG_WHOLE_PER_100G, true)).toBeNull();
    expect(inferNaturalServingFromName("Egg, Benedict", EGG_WHOLE_PER_100G, true)).toBeNull();
    expect(inferNaturalServingFromName("Egg roll, meatless", EGG_WHOLE_PER_100G, true)).toBeNull();
  });

  it("handles empty / whitespace input safely", () => {
    expect(inferNaturalServingFromName("", EGG_WHOLE_PER_100G, true)).toBeNull();
    expect(inferNaturalServingFromName("   ", EGG_WHOLE_PER_100G, true)).toBeNull();
  });

  it("infers vegetables (1 medium tomato, carrot, cucumber)", () => {
    expect(inferNaturalServingFromName("Tomatoes, raw, red, ripe", { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 }, true)?.grams).toBe(123);
    expect(inferNaturalServingFromName("Carrots, raw", { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 }, true)?.grams).toBe(61);
    expect(inferNaturalServingFromName("Cucumber, raw, with peel", { calories: 16, protein: 0.7, carbs: 3.6, fat: 0.1 }, true)?.grams).toBe(201);
  });

  it("infers fruits (1 medium pear, peach, plum)", () => {
    expect(inferNaturalServingFromName("Pears, raw", { calories: 57, protein: 0.4, carbs: 15.2, fat: 0.1 }, true)?.grams).toBe(178);
    expect(inferNaturalServingFromName("Peaches, raw", { calories: 39, protein: 0.9, carbs: 9.5, fat: 0.3 }, true)?.grams).toBe(150);
    expect(inferNaturalServingFromName("Plums, raw", { calories: 46, protein: 0.7, carbs: 11.4, fat: 0.3 }, true)?.grams).toBe(66);
  });
});
