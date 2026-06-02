import { describe, expect, it } from "vitest";

import {
  foodSearchRankScore,
  foodSearchTrustWeight,
  searchRelevance,
  searchMatchScore,
  searchRowConfidenceTier,
  splitBestMatches,
  RECENTLY_LOGGED_BOOST,
  VERIFIED_TIER_MIN_SCORE,
  BEST_MATCH_MIN_SCORE,
} from "@/lib/nutrition/foodSearchRanking";

describe("searchRelevance", () => {
  it("returns 1 for an exact normalized match", () => {
    expect(searchRelevance("Greek Yogurt", "greek yogurt")).toBe(1);
  });

  it("returns 0 when query or name is empty", () => {
    expect(searchRelevance("", "eggs")).toBe(0);
    expect(searchRelevance("eggs", "")).toBe(0);
  });

  it("ranks shorter exact-token hits above noisy long names", () => {
    const short = searchRelevance("eggs", "Eggs, Grade A, Large");
    const long = searchRelevance(
      "eggs",
      "Egg Substitute Powder With Added Vitamin D",
    );
    expect(short).toBeGreaterThan(long);
  });
});

describe("foodSearchTrustWeight", () => {
  it("boosts verified USDA and demotes generic OFF hardest", () => {
    expect(
      foodSearchTrustWeight({ source: "USDA", verified: true, name: "Eggs" }),
    ).toBe(0.1);
    expect(
      foodSearchTrustWeight({ source: "USDA", verified: false, name: "Eggs" }),
    ).toBe(-0.15);
    expect(
      foodSearchTrustWeight({ source: "OFF", name: "Brand · Product" }),
    ).toBe(-0.1);
    expect(
      foodSearchTrustWeight({ source: "OFF", name: "Generic Powder" }),
    ).toBe(-0.2);
  });

  it("applies the same commercial-source band to Edamam and FatSecret", () => {
    expect(
      foodSearchTrustWeight({ source: "Edamam", name: "McDonald's · Big Mac" }),
    ).toBe(-0.05);
    expect(
      foodSearchTrustWeight({ source: "FatSecret", name: "McDonald's · Big Mac" }),
    ).toBe(-0.05);
  });

  it("returns zero for custom or generic sources", () => {
    expect(foodSearchTrustWeight({ source: "CUSTOM", name: "My food" })).toBe(0);
  });
});

describe("foodSearchRankScore", () => {
  it("lets verified USDA beat a near-tie OFF row", () => {
    const usda = foodSearchRankScore({
      query: "eggs",
      name: "Eggs, Grade A, Large, egg whole",
      source: "USDA",
      verified: true,
    });
    const off = foodSearchRankScore({
      query: "eggs",
      name: "Brand · Eggs",
      source: "OFF",
    });
    expect(usda).toBeGreaterThan(off);
  });

  it("adds the recently-logged boost as a tie-break only", () => {
    const base = foodSearchRankScore({
      query: "greek yogurt",
      name: "Greek Yogurt, Plain, Nonfat",
      source: "USDA",
      verified: true,
    });
    const boosted = foodSearchRankScore({
      query: "greek yogurt",
      name: "Greek Yogurt, Plain, Nonfat",
      source: "USDA",
      verified: true,
      recentlyLogged: true,
    });
    expect(boosted - base).toBeCloseTo(RECENTLY_LOGGED_BOOST, 5);
    // The boost is small enough that it never floats an irrelevant row over a
    // real match: a recently-logged off-topic row must still lose to a fresh
    // on-target verified hit.
    const offTopicRecent = foodSearchRankScore({
      query: "salmon",
      name: "Brand · Chocolate Bar",
      source: "OFF",
      recentlyLogged: true,
    });
    const onTargetFresh = foodSearchRankScore({
      query: "salmon",
      name: "Salmon, Atlantic, raw",
      source: "USDA",
      verified: true,
    });
    expect(onTargetFresh).toBeGreaterThan(offTopicRecent);
  });
});

describe("searchMatchScore — stronger relevance (ENG-807)", () => {
  it("stems plural ↔ singular (eggs ↔ egg)", () => {
    expect(searchMatchScore("eggs", "Egg, whole, raw")).toBeGreaterThan(0.5);
    expect(searchMatchScore("tomatoes", "Tomato, red, ripe, raw")).toBeGreaterThan(0.5);
  });

  it("penalises long containing-candidates vs the canonical food", () => {
    const canonical = searchMatchScore("zucchini", "Zucchini, raw");
    const containing = searchMatchScore("zucchini", "Bread, zucchini");
    expect(canonical).toBeGreaterThan(containing);
  });

  it("boosts a prefix / first-word match", () => {
    const firstWord = searchMatchScore("chicken breast", "Chicken, breast, meat only, raw");
    const subIngredient = searchMatchScore("chicken breast", "Soup, chicken breast, canned");
    expect(firstWord).toBeGreaterThan(subIngredient);
  });

  it("strips an OFF brand prefix before matching the food", () => {
    // "Lidl · Free Range Eggs" should match "eggs" on the food part, not be
    // diluted by the brand token.
    expect(searchMatchScore("eggs", "Lidl · Free Range Eggs")).toBeGreaterThan(0.4);
  });

  it("returns 0 on empty input and 1 on exact normalized match", () => {
    expect(searchMatchScore("", "eggs")).toBe(0);
    expect(searchMatchScore("eggs", "")).toBe(0);
    expect(searchMatchScore("Greek Yogurt", "greek yogurt")).toBe(1);
  });
});

describe("searchRowConfidenceTier — honest confidence (ENG-807)", () => {
  it("marks a strong-match verified USDA row as verified", () => {
    expect(
      searchRowConfidenceTier({
        source: "USDA",
        verified: true,
        matchScore: searchMatchScore("eggs", "Eggs, Grade A, Large, egg whole"),
      }),
    ).toBe("verified");
  });

  it("never marks a branded product verified from source alone", () => {
    // USDA Branded "EGGS" carries verified:false even with high token overlap.
    expect(
      searchRowConfidenceTier({ source: "USDA", verified: false, matchScore: 1 }),
    ).toBe("estimated");
    // OFF / Edamam / FatSecret are commercial — never auto-verified.
    expect(
      searchRowConfidenceTier({ source: "OFF", verified: false, matchScore: 1 }),
    ).toBe("estimated");
    expect(
      searchRowConfidenceTier({ source: "FatSecret", verified: false, matchScore: 1 }),
    ).toBe("estimated");
  });

  it("demotes an authoritative-but-weak-match row to estimated", () => {
    // Verifiable provenance, but the name match is below the verified bar →
    // we don't claim the row IS what the user typed.
    expect(
      searchRowConfidenceTier({
        source: "USDA",
        verified: true,
        matchScore: VERIFIED_TIER_MIN_SCORE - 0.01,
      }),
    ).toBe("estimated");
    expect(
      searchRowConfidenceTier({
        source: "USDA",
        verified: true,
        matchScore: VERIFIED_TIER_MIN_SCORE,
      }),
    ).toBe("verified");
  });

  it("treats curated generic foods as verifiable provenance", () => {
    expect(
      searchRowConfidenceTier({ source: "GenericFood", verified: true, matchScore: 0.9 }),
    ).toBe("verified");
    expect(
      searchRowConfidenceTier({ source: "GenericBeverage", verified: true, matchScore: 0.9 }),
    ).toBe("verified");
  });
});

describe("splitBestMatches — Best matches / More results (ENG-807)", () => {
  const rows = [
    { name: "a", score: 0.9 },
    { name: "b", score: 0.7 },
    { name: "c", score: 0.5 },
    { name: "d", score: 0.2 },
  ];

  it("splits by the shared score threshold, preserving order", () => {
    const { best, more } = splitBestMatches(rows, (r) => r.score);
    expect(best.map((r) => r.name)).toEqual(["a", "b"]);
    expect(more.map((r) => r.name)).toEqual(["c", "d"]);
  });

  it("uses BEST_MATCH_MIN_SCORE as the boundary", () => {
    const boundary = [
      { name: "on", score: BEST_MATCH_MIN_SCORE },
      { name: "under", score: BEST_MATCH_MIN_SCORE - 0.0001 },
    ];
    const { best, more } = splitBestMatches(boundary, (r) => r.score);
    expect(best.map((r) => r.name)).toEqual(["on"]);
    expect(more.map((r) => r.name)).toEqual(["under"]);
  });

  it("never leaves Best empty while More has rows (promotes the top row)", () => {
    const allLow = [
      { name: "x", score: 0.4 },
      { name: "y", score: 0.3 },
    ];
    const { best, more } = splitBestMatches(allLow, (r) => r.score);
    expect(best.map((r) => r.name)).toEqual(["x"]);
    expect(more.map((r) => r.name)).toEqual(["y"]);
  });

  it("returns empty sections for an empty list", () => {
    expect(splitBestMatches([], () => 1)).toEqual({ best: [], more: [] });
  });
});

describe("foodSearchPreviewPlausibilityWarning", () => {
  it("flags implausible per-100 g scaling in preview hosts", async () => {
    const { foodSearchPreviewPlausibilityWarning } = await import(
      "@/lib/nutrition/portionPicker"
    );
    const warning = foodSearchPreviewPlausibilityWarning(
      { calories: 100, protein: 10, carbs: 5, fat: 5 },
      { calories: 2625, protein: 250, carbs: 25, fat: 175 },
      500,
    );
    expect(warning).toEqual(expect.stringMatching(/looks unusually high/i));
  });

  it("returns null when there is no per-100 g basis", async () => {
    const { foodSearchPreviewPlausibilityWarning } = await import(
      "@/lib/nutrition/portionPicker"
    );
    expect(
      foodSearchPreviewPlausibilityWarning(null, { calories: 100, protein: 10 }, 100),
    ).toBeNull();
  });

  it("returns null when gram weight is zero", async () => {
    const { foodSearchPreviewPlausibilityWarning } = await import(
      "@/lib/nutrition/portionPicker"
    );
    expect(
      foodSearchPreviewPlausibilityWarning(
        { calories: 100, protein: 10, carbs: 0, fat: 0 },
        { calories: 100, protein: 10 },
        0,
      ),
    ).toBeNull();
  });
});
