/**
 * B5 Phase 2b (2026-04-27) — pin the shared Discover filter semantics
 * so web (FilterSheet drawer) and mobile (FilterSheet bottom sheet)
 * cannot drift.
 */
import { describe, it, expect } from "vitest";
import {
  applyDiscoverFilters,
  countAppliedFilters,
  EMPTY_FILTERS,
  filtersAreEmpty,
  passesDiscoverFilters,
  type FilterableRecipe,
} from "../../src/lib/discover/filterRecipes";
import {
  classifyRecipeCuisine,
  normalizeCuisine,
} from "../../src/lib/recipes/normalizeCuisine";

const sample: FilterableRecipe[] = [
  { cuisine: "italian", cookTimeMin: 20, dietaryFlags: ["high-protein"] },
  { cuisine: "asian", cookTimeMin: 12, dietaryFlags: ["vegan"] },
  { cuisine: "italian", cookTimeMin: 65, dietaryFlags: [] },
  { cuisine: null, cookTimeMin: 30, dietaryFlags: ["high-protein", "keto"] },
  { cuisine: "indian", cookTimeMin: null, dietaryFlags: ["vegetarian"] },
];

describe("passesDiscoverFilters — empty filters always pass", () => {
  it("matches every row when filters are empty", () => {
    for (const r of sample) {
      expect(passesDiscoverFilters(r, EMPTY_FILTERS)).toBe(true);
    }
  });

  it("filtersAreEmpty is true for the constant", () => {
    expect(filtersAreEmpty(EMPTY_FILTERS)).toBe(true);
  });

  it("countAppliedFilters is 0 for the constant", () => {
    expect(countAppliedFilters(EMPTY_FILTERS)).toBe(0);
  });
});

describe("cuisine filter — multi-select OR within dimension", () => {
  it("excludes rows whose cuisine isn't selected", () => {
    const out = applyDiscoverFilters(sample, {
      ...EMPTY_FILTERS,
      cuisines: ["italian"],
    });
    expect(out.length).toBe(2);
    expect(out.every((r) => r.cuisine === "italian")).toBe(true);
  });

  it("OR within selection — italian + asian gives both", () => {
    const out = applyDiscoverFilters(sample, {
      ...EMPTY_FILTERS,
      cuisines: ["italian", "asian"],
    });
    expect(out.length).toBe(3);
  });

  it("excludes null-cuisine rows when ANY cuisine is selected", () => {
    const out = applyDiscoverFilters(sample, {
      ...EMPTY_FILTERS,
      cuisines: ["italian"],
    });
    expect(out.find((r) => r.cuisine == null)).toBeUndefined();
  });
});

describe("cookTime filter — bucket semantics", () => {
  it("≤15 matches rows with cookTimeMin ≤ 15", () => {
    const out = applyDiscoverFilters(sample, { ...EMPTY_FILTERS, cookTimes: ["≤15"] });
    expect(out.length).toBe(1);
    expect(out[0].cookTimeMin).toBe(12);
  });

  it("≤30 includes rows ≤ 30 (15+30 boundaries)", () => {
    const out = applyDiscoverFilters(sample, { ...EMPTY_FILTERS, cookTimes: ["≤30"] });
    expect(out.length).toBe(3);
  });

  it("60+ matches null cookTimeMin AND rows > 60", () => {
    const out = applyDiscoverFilters(sample, { ...EMPTY_FILTERS, cookTimes: ["60+"] });
    // expected: cookTimeMin=65 and cookTimeMin=null
    expect(out.length).toBe(2);
    expect(out.some((r) => r.cookTimeMin === 65)).toBe(true);
    expect(out.some((r) => r.cookTimeMin == null)).toBe(true);
  });

  it("multi-bucket OR — ≤15 + 60+ stacks", () => {
    const out = applyDiscoverFilters(sample, {
      ...EMPTY_FILTERS,
      cookTimes: ["≤15", "60+"],
    });
    expect(out.length).toBe(3); // 12, 65, null
  });
});

describe("dietary filter — multi-select AND across selections", () => {
  it("matches rows that have ALL selected presets", () => {
    const out = applyDiscoverFilters(sample, {
      ...EMPTY_FILTERS,
      dietary: ["high-protein", "keto"],
    });
    // Only the row with both high-protein AND keto should pass.
    expect(out.length).toBe(1);
    expect(out[0].dietaryFlags).toContain("high-protein");
    expect(out[0].dietaryFlags).toContain("keto");
  });

  it("single preset works as OR equivalent (all rows containing it)", () => {
    const out = applyDiscoverFilters(sample, {
      ...EMPTY_FILTERS,
      dietary: ["high-protein"],
    });
    expect(out.length).toBe(2);
  });

  it("empty preset list applies no dietary constraint", () => {
    const out = applyDiscoverFilters(sample, EMPTY_FILTERS);
    expect(out.length).toBe(sample.length);
  });
});

describe("AND across dimensions", () => {
  it("italian + ≤30 + high-protein → exactly the 20-min row", () => {
    const out = applyDiscoverFilters(sample, {
      cuisines: ["italian"],
      cookTimes: ["≤30"],
      dietary: ["high-protein"],
    });
    expect(out.length).toBe(1);
    expect(out[0].cookTimeMin).toBe(20);
  });

  it("italian + 60+ → 1 result (the 65-min row)", () => {
    const out = applyDiscoverFilters(sample, {
      cuisines: ["italian"],
      cookTimes: ["60+"],
      dietary: [],
    });
    expect(out.length).toBe(1);
    expect(out[0].cookTimeMin).toBe(65);
  });
});

describe("countAppliedFilters", () => {
  it("sums across dimensions", () => {
    expect(
      countAppliedFilters({
        cuisines: ["italian", "asian"],
        cookTimes: ["≤30"],
        dietary: ["vegan", "gluten-free", "high-protein"],
      }),
    ).toBe(6);
  });
});

describe("normalizeCuisine — keyword routing", () => {
  it("routes Italian dishes to italian", () => {
    expect(normalizeCuisine("Spaghetti Carbonara")).toBe("italian");
    expect(normalizeCuisine("Mushroom Risotto")).toBe("italian");
    expect(normalizeCuisine("Margherita Pizza")).toBe("italian");
  });

  it("routes Asian dishes to asian", () => {
    expect(normalizeCuisine("Chicken Pad Thai")).toBe("asian");
    expect(normalizeCuisine("Salmon teriyaki")).toBe("asian");
    expect(normalizeCuisine("Beef stir-fry")).toBe("asian");
  });

  it("routes Mexican dishes to mexican", () => {
    expect(normalizeCuisine("Beef Burrito")).toBe("mexican");
    expect(normalizeCuisine("Chicken Tacos")).toBe("mexican");
  });

  it("routes Indian dishes to indian", () => {
    expect(normalizeCuisine("Chicken Tikka Masala")).toBe("indian");
    expect(normalizeCuisine("Lamb Biryani")).toBe("indian");
  });

  it("routes Middle Eastern dishes to middle-eastern", () => {
    expect(normalizeCuisine("Lamb Shawarma")).toBe("middle-eastern");
    expect(normalizeCuisine("Vegetable Tagine")).toBe("middle-eastern");
  });

  it("returns null for unrecognised inputs", () => {
    expect(normalizeCuisine("Random Title")).toBeNull();
    expect(normalizeCuisine(null)).toBeNull();
    expect(normalizeCuisine("")).toBeNull();
  });
});

describe("classifyRecipeCuisine — multi-source classification", () => {
  it("falls through title → tags → sourceName", () => {
    expect(classifyRecipeCuisine({ title: "Spaghetti", tags: [], sourceName: null })).toBe("italian");
    expect(classifyRecipeCuisine({ title: null, tags: ["Asian", "Quick"], sourceName: null })).toBe("asian");
    expect(
      classifyRecipeCuisine({ title: null, tags: [], sourceName: "Bon Appétit · Italian" }),
    ).toBe("italian");
  });

  it("returns null when nothing matches", () => {
    expect(
      classifyRecipeCuisine({ title: "Lemon Drizzle Cake", tags: [], sourceName: null }),
    ).toBeNull();
  });
});
