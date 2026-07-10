import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOOD_FALLBACK_GLYPH_BY_CATEGORY,
  FOOD_FALLBACK_SAMPLE_CATEGORIES,
  FOOD_FALLBACK_TINT_BY_CATEGORY,
  normalizeFoodTitle,
  resolveFoodFallback,
  resolveFoodFallbackSampleCategory,
  type FoodFallbackCategoryId,
} from "../../src/lib/imagery/foodFallbackCategory";
import { HERO_TINTS } from "../../src/lib/recipe/recipeHeroFallback";

describe("foodFallbackCategory (ENG-1015 / ENG-1448 tiered)", () => {
  it("normalizes titles for stable matching", () => {
    expect(normalizeFoodTitle("  Chicken & Rice!!! ")).toBe("chicken rice");
  });

  it("resolves the category tier on confident keyword hits", () => {
    const cases: Array<[string, FoodFallbackCategoryId]> = [
      ["Tonkotsu ramen bowl", "ramen-noodles"],
      ["Greek salad", "salad"],
      ["Berry smoothie", "smoothie"],
      // Conservative table extension — plurals + obvious synonyms:
      ["Blueberry pancakes", "pancakes-waffles"],
      ["Two scrambled eggs", "eggs"],
      ["Ham sandwiches", "toast-sandwich"],
      ["Spaghetti bolognese", "pasta"],
      ["Chicken tikka masala", "curry"],
      ["Beef meatballs", "red-meat"],
      ["Strawberries", "fruit"],
      ["Iced latte", "drink"],
      ["Jacket potatoes", "vegetables-sides"],
    ];
    for (const [title, category] of cases) {
      expect(resolveFoodFallback(title)).toMatchObject({ tier: "category", category });
    }
  });

  it("photo-confidence split: ambiguous keywords keep the honest glyph+tint category but NEVER license the sample photo", () => {
    // The refuter's bug class: "zucchini noodles" is honestly a noodle
    // GLYPH, but the tonkotsu ramen PHOTO would be a fabrication.
    const ambiguous: Array<[string, FoodFallbackCategoryId]> = [
      ["Zucchini noodles", "ramen-noodles"],
      ["Pho with beef brisket", "ramen-noodles"],
      ["Protein shake", "smoothie"],
      ["Strawberry milkshake", "smoothie"],
      ["Greek yogurt bowl", "breakfast-bowl"],
      ["Overnight oats", "breakfast-bowl"],
      ["Greek salad", "salad"],
      ["Fruit salad", "salad"],
      ["Spaghetti bolognese", "pasta"],
      ["Mac & cheese", "pasta"],
      ["Grilled chicken breast", "chicken"],
      ["Chicken wings", "chicken"],
    ];
    for (const [title, category] of ambiguous) {
      expect(resolveFoodFallback(title), title).toMatchObject({
        tier: "category",
        category,
        photoConfident: false,
      });
    }
  });

  it("photo-confidence split: dish-specific strings naming the literal shipped sample stay photo-confident", () => {
    const confident: Array<[string, FoodFallbackCategoryId]> = [
      ["Tonkotsu ramen bowl", "ramen-noodles"],
      ["Berry smoothie", "smoothie"],
      ["Berry breakfast bowl", "breakfast-bowl"],
      ["Roast chicken", "chicken"],
      ["Roasted chicken with herbs", "chicken"],
      ["Green salad", "salad"],
      ["Garden salad", "salad"],
      ["Pasta with tomato sauce", "pasta"],
    ];
    for (const [title, category] of confident) {
      expect(resolveFoodFallback(title), title).toMatchObject({
        tier: "category",
        category,
        photoConfident: true,
      });
    }
  });

  it("photo confidence only ever pairs with a shipped sample category", () => {
    // Sweep a broad title corpus: any photoConfident hit must resolve a
    // shipped sample — a confident photo licence for an unshipped
    // category would be dead at best, a fabrication risk at worst.
    const corpus = [
      "Tonkotsu ramen", "Berry smoothie", "Breakfast bowl", "Roast chicken",
      "Green salad", "Pasta", "Salmon fillet", "Pepperoni pizza", "Beef burger",
      "Chicken curry", "Chocolate cake", "Fried eggs on toast", "Poke bowl",
    ];
    for (const title of corpus) {
      const res = resolveFoodFallback(title);
      if (res.tier === "category" && res.photoConfident) {
        expect(resolveFoodFallbackSampleCategory(res.category), title).not.toBeNull();
      }
    }
  });

  it("carries a glyph + §11.4 tint on every tier", () => {
    const hit = resolveFoodFallback("Greek salad");
    expect(hit).toMatchObject({ tier: "category", glyph: "Salad", tint: HERO_TINTS.greens });
    const slot = resolveFoodFallback("Grace's usual", { slot: "Breakfast" });
    expect(slot).toMatchObject({ tier: "slot", slot: "Breakfast", glyph: "Coffee", tint: HERO_TINTS.ambers });
    const generic = resolveFoodFallback("Grace's usual");
    expect(generic).toMatchObject({ tier: "generic", glyph: "Utensils", tint: HERO_TINTS.default });
  });

  it("every category has a glyph and a tint drawn from the shared HERO_TINTS family", () => {
    const legalTints = new Set<string>(Object.values(HERO_TINTS));
    for (const [category, tint] of Object.entries(FOOD_FALLBACK_TINT_BY_CATEGORY)) {
      expect(legalTints.has(tint), `${category} tint ${tint} not in HERO_TINTS`).toBe(true);
      expect(
        FOOD_FALLBACK_GLYPH_BY_CATEGORY[category as FoodFallbackCategoryId],
      ).toBeTruthy();
    }
  });

  it("ambiguous titles NEVER claim a category — slot tier when a slot is passed, generic otherwise", () => {
    // The ENG-1448 bug class: the old fnv1a32 hash remapped these into a
    // 4-category pool, painting confidently wrong art on unknown foods.
    const ambiguous = ["Grace's leftovers", "Homemade thing", "Meal deal", "xyzzy"];
    for (const title of ambiguous) {
      expect(resolveFoodFallback(title).tier).toBe("generic");
      expect(resolveFoodFallback(title, { slot: "Dinner" })).toMatchObject({
        tier: "slot",
        slot: "Dinner",
        glyph: "UtensilsCrossed",
      });
    }
    // Slot strings normalise via the canonical normaliseMealSlot ("snack" → Snacks).
    expect(resolveFoodFallback("", { slot: "snack" })).toMatchObject({ tier: "slot", slot: "Snacks" });
    // Junk slots never claim the slot tier.
    expect(resolveFoodFallback("", { slot: "brunch" }).tier).toBe("generic");
  });

  it("passes shipped sample categories through unchanged", () => {
    for (const shipped of FOOD_FALLBACK_SAMPLE_CATEGORIES) {
      expect(resolveFoodFallbackSampleCategory(shipped)).toBe(shipped);
    }
  });

  it("ENG-1478 regression guard: unshipped categories return null — never a wrong specific sample", () => {
    // The captured bug: "Salmon, potatoes & greens" → "fish" → hash-remapped
    // to the berry-smoothie asset. A wrong specific image is worse than none.
    expect(resolveFoodFallback("PERSONA: Salmon, potatoes & greens")).toMatchObject({
      tier: "category",
      category: "fish",
    });
    expect(resolveFoodFallbackSampleCategory("fish")).toBeNull();
    for (const unshipped of ["curry", "eggs", "pizza", "burger", "dessert", "rice-bowl"] as const) {
      expect(resolveFoodFallbackSampleCategory(unshipped)).toBeNull();
    }
  });

  it("repo-scan pin: the fnv1a32 / HASH_FALLBACK_POOL fabrication path never returns (ENG-1448)", () => {
    const roots = [
      resolve(__dirname, "../../src/lib/imagery"),
      resolve(__dirname, "../../apps/mobile/components"),
      resolve(__dirname, "../../apps/mobile/lib"),
    ];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name.startsWith(".")) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
        } else if (/\.(ts|tsx)$/.test(name)) {
          const src = readFileSync(p, "utf8");
          // The doc-comment history mention in foodFallbackCategory.ts is
          // fine — flag only real identifiers (declaration or call/use).
          if (/\b(function\s+fnv1a32|fnv1a32\s*\(|HASH_FALLBACK_POOL\s*[[:=.])/.test(src)) {
            offenders.push(p);
          }
        }
      }
    };
    for (const root of roots) walk(root);
    expect(offenders).toEqual([]);
  });
});
