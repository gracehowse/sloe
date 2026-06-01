/**
 * Golden-query ranking regression (ENG-807).
 *
 * Pins the relevance scorer against ~28 real-world food queries with their
 * expected top-1 / top-3 ranking. Each query carries a deterministic candidate
 * pool of synthetic source rows (NO live API) shaped like what USDA / OFF /
 * Edamam / FatSecret actually return — verified USDA generics, USDA Branded
 * mislabels, OFF brand rows, Edamam category-tag noise, etc.
 *
 * This is a pure scorer test: it exercises `foodSearchRankScore` +
 * `searchRowConfidenceTier` exactly as both `mergeResults` (mobile) and
 * `mergeAndDedup` (web) call them, so a regression in the shared math fails CI
 * before it can ship a worse search experience on either platform.
 *
 * If a legitimate scorer improvement changes a golden expectation, update the
 * expectation here in the same change — never silence the test. The candidate
 * pools are stable, so a diff here is a real ranking change worth reviewing.
 */
import { describe, expect, it } from "vitest";

import {
  foodSearchRankScore,
  searchMatchScore,
  searchRowConfidenceTier,
  type FoodSearchTrustSource,
} from "@/lib/nutrition/foodSearchRanking";

type Candidate = {
  name: string;
  source: FoodSearchTrustSource;
  verified?: boolean;
};

type GoldenCase = {
  query: string;
  /** Synthetic candidate pool (order irrelevant — the scorer ranks). */
  pool: Candidate[];
  /** Expected #1 result name after ranking. */
  top1: string;
  /** Optional names that must all appear in the top 3 (order-agnostic). */
  top3?: string[];
};

function rank(query: string, pool: Candidate[]): Candidate[] {
  return [...pool].sort(
    (a, b) =>
      foodSearchRankScore({ query, name: b.name, source: b.source, verified: b.verified }) -
      foodSearchRankScore({ query, name: a.name, source: a.source, verified: a.verified }),
  );
}

// A few reusable noise rows that recur across pools.
const usdaBrandedEggsMislabel: Candidate = { name: "EGGS", source: "USDA", verified: false };
const edamamCacioRavioli: Candidate = { name: "Cacio E Pepe Ravioli", source: "Edamam" };

const GOLDEN: GoldenCase[] = [
  {
    query: "eggs",
    pool: [
      { name: "Eggs, Grade A, Large, egg whole", source: "USDA", verified: true },
      usdaBrandedEggsMislabel,
      { name: "Lidl · Free Range Eggs", source: "OFF" },
      edamamCacioRavioli,
      { name: "Bagels, egg", source: "USDA", verified: true },
    ],
    top1: "Eggs, Grade A, Large, egg whole",
  },
  {
    query: "banana",
    pool: [
      { name: "Bananas, raw", source: "USDA", verified: true },
      { name: "Brand · Banana Bread", source: "OFF" },
      { name: "Banana Nut Muffin", source: "Edamam" },
      { name: "Chiquita · Banana", source: "FatSecret" },
    ],
    top1: "Bananas, raw",
    top3: ["Bananas, raw", "Chiquita · Banana"],
  },
  {
    query: "chicken breast",
    pool: [
      { name: "Chicken, broilers or fryers, breast, meat only, raw", source: "USDA", verified: true },
      { name: "Soup, chicken breast, canned", source: "USDA", verified: true },
      { name: "Tyson · Breaded Chicken Breast Strips", source: "FatSecret" },
      { name: "Chicken Breast Sandwich", source: "Edamam" },
    ],
    top1: "Chicken, broilers or fryers, breast, meat only, raw",
  },
  {
    query: "greek yogurt",
    pool: [
      { name: "Yogurt, Greek, plain, nonfat", source: "USDA", verified: true },
      { name: "Chobani · Greek Yogurt Strawberry", source: "FatSecret" },
      { name: "Brand · Greek Yogurt Dressing", source: "OFF" },
    ],
    top1: "Yogurt, Greek, plain, nonfat",
  },
  {
    query: "white rice",
    pool: [
      { name: "Rice, white, long-grain, regular, raw, enriched", source: "USDA", verified: true },
      { name: "Brand · White Rice Cakes", source: "OFF" },
      { name: "Dirty Rice", source: "Edamam" },
    ],
    top1: "Rice, white, long-grain, regular, raw, enriched",
  },
  {
    query: "salmon",
    pool: [
      { name: "Fish, salmon, Atlantic, wild, raw", source: "USDA", verified: true },
      { name: "Brand · Salmon Pâté", source: "OFF" },
      { name: "Salmon Sushi Roll", source: "Edamam" },
    ],
    top1: "Fish, salmon, Atlantic, wild, raw",
  },
  {
    query: "cheddar cheese",
    pool: [
      { name: "Cheese, cheddar", source: "USDA", verified: true },
      { name: "Brand · Cheddar Cheese Crackers", source: "OFF" },
      { name: "Cabot · Sharp Cheddar", source: "FatSecret" },
    ],
    top1: "Cheese, cheddar",
  },
  {
    query: "almond milk",
    pool: [
      { name: "Beverages, almond milk, unsweetened, shelf stable", source: "USDA", verified: true },
      { name: "Brand · Almond Milk Chocolate", source: "OFF" },
      { name: "Almond Milk Latte", source: "Edamam" },
    ],
    top1: "Beverages, almond milk, unsweetened, shelf stable",
  },
  {
    query: "peanut butter",
    pool: [
      { name: "Peanut butter, smooth style, with salt", source: "USDA", verified: true },
      { name: "Brand · Peanut Butter Cups", source: "OFF" },
      { name: "Peanut Butter Cookie", source: "Edamam" },
    ],
    top1: "Peanut butter, smooth style, with salt",
  },
  {
    query: "oats",
    pool: [
      { name: "Oats, whole grain, rolled, old fashioned", source: "USDA", verified: true },
      { name: "Brand · Oat Bar Chocolate", source: "OFF" },
      { name: "Oatmeal Raisin Cookie", source: "Edamam" },
    ],
    top1: "Oats, whole grain, rolled, old fashioned",
  },
  {
    query: "broccoli",
    pool: [
      { name: "Broccoli, raw", source: "USDA", verified: true },
      { name: "Brand · Broccoli Cheddar Soup", source: "OFF" },
      { name: "Broccoli Salad", source: "Edamam" },
    ],
    top1: "Broccoli, raw",
  },
  {
    query: "avocado",
    pool: [
      { name: "Avocados, raw, all commercial varieties", source: "USDA", verified: true },
      { name: "Brand · Avocado Oil Spray", source: "OFF" },
      { name: "Avocado Toast", source: "Edamam" },
    ],
    top1: "Avocados, raw, all commercial varieties",
  },
  {
    query: "ground beef",
    pool: [
      { name: "Beef, ground, 85% lean meat / 15% fat, raw", source: "USDA", verified: true },
      { name: "Brand · Ground Beef Jerky", source: "OFF" },
      { name: "Ground Beef Taco", source: "Edamam" },
    ],
    top1: "Beef, ground, 85% lean meat / 15% fat, raw",
  },
  {
    query: "sweet potato",
    pool: [
      { name: "Sweet potato, raw, unprepared", source: "USDA", verified: true },
      { name: "Brand · Sweet Potato Chips", source: "OFF" },
      { name: "Sweet Potato Fries", source: "Edamam" },
    ],
    top1: "Sweet potato, raw, unprepared",
  },
  {
    query: "spinach",
    pool: [
      { name: "Spinach, raw", source: "USDA", verified: true },
      { name: "Brand · Spinach Artichoke Dip", source: "OFF" },
      { name: "Spinach Lasagna", source: "Edamam" },
    ],
    top1: "Spinach, raw",
  },
  {
    query: "big mac",
    pool: [
      { name: "McDonald's · Big Mac", source: "FatSecret" },
      { name: "Mcdonald's, Big Mac", source: "USDA", verified: false },
      { name: "Big Mac Salad", source: "Edamam" },
    ],
    // No verified-generic exists for a branded burger — FatSecret's branded
    // row is the right answer over the USDA Branded scrape.
    top3: ["McDonald's · Big Mac"],
    top1: "McDonald's · Big Mac",
  },
  {
    query: "olive oil",
    pool: [
      { name: "Oil, olive, salad or cooking", source: "USDA", verified: true },
      { name: "Brand · Olive Oil Mayonnaise", source: "OFF" },
      { name: "Olive Oil Cake", source: "Edamam" },
    ],
    top1: "Oil, olive, salad or cooking",
  },
  {
    query: "whole milk",
    pool: [
      { name: "Milk, whole, 3.25% milkfat, with added vitamin D", source: "USDA", verified: true },
      { name: "Brand · Whole Milk Chocolate Bar", source: "OFF" },
    ],
    top1: "Milk, whole, 3.25% milkfat, with added vitamin D",
  },
  {
    query: "black beans",
    pool: [
      { name: "Beans, black, mature seeds, cooked, boiled, without salt", source: "USDA", verified: true },
      { name: "Brand · Black Bean Burger", source: "OFF" },
      { name: "Black Bean Soup", source: "Edamam" },
    ],
    top1: "Beans, black, mature seeds, cooked, boiled, without salt",
  },
  {
    query: "apple",
    pool: [
      { name: "Apples, raw, with skin", source: "USDA", verified: true },
      { name: "Brand · Apple Cinnamon Bagel", source: "OFF" },
      { name: "Apple Pie", source: "Edamam" },
      { name: "Brand · Apple Juice", source: "OFF" },
    ],
    top1: "Apples, raw, with skin",
  },
  {
    query: "quinoa",
    pool: [
      { name: "Quinoa, cooked", source: "USDA", verified: true },
      { name: "Brand · Quinoa Crackers", source: "OFF" },
      { name: "Quinoa Salad", source: "Edamam" },
    ],
    top1: "Quinoa, cooked",
  },
  {
    query: "tofu",
    pool: [
      { name: "Tofu, raw, firm, prepared with calcium sulfate", source: "USDA", verified: true },
      { name: "Brand · Crispy Tofu Bites", source: "OFF" },
      { name: "Tofu Stir Fry", source: "Edamam" },
    ],
    top1: "Tofu, raw, firm, prepared with calcium sulfate",
  },
  {
    query: "cottage cheese",
    pool: [
      { name: "Cheese, cottage, lowfat, 2% milkfat", source: "USDA", verified: true },
      { name: "Brand · Cottage Cheese Dip", source: "OFF" },
    ],
    top1: "Cheese, cottage, lowfat, 2% milkfat",
  },
  {
    query: "orange juice",
    pool: [
      { name: "Orange juice, raw", source: "USDA", verified: true },
      { name: "Tropicana · Orange Juice", source: "FatSecret" },
      { name: "Orange Juice Cake", source: "Edamam" },
    ],
    top1: "Orange juice, raw",
  },
  {
    query: "bacon",
    pool: [
      { name: "Bacon, cooked", source: "USDA", verified: true },
      { name: "Brand · Bacon Bits", source: "OFF" },
      { name: "Bacon Cheeseburger", source: "Edamam" },
    ],
    top1: "Bacon, cooked",
  },
  {
    query: "lentils",
    pool: [
      { name: "Lentils, mature seeds, cooked, boiled, without salt", source: "USDA", verified: true },
      { name: "Brand · Lentil Chips", source: "OFF" },
      { name: "Lentil Curry", source: "Edamam" },
    ],
    top1: "Lentils, mature seeds, cooked, boiled, without salt",
  },
  {
    query: "strawberries",
    pool: [
      { name: "Strawberries, raw", source: "USDA", verified: true },
      { name: "Brand · Strawberry Yogurt", source: "OFF" },
      { name: "Strawberry Milkshake", source: "Edamam" },
    ],
    top1: "Strawberries, raw",
  },
  {
    query: "brown rice",
    pool: [
      { name: "Rice, brown, long-grain, cooked", source: "USDA", verified: true },
      { name: "Brand · Brown Rice Syrup", source: "OFF" },
      { name: "Brown Rice Bowl", source: "Edamam" },
    ],
    top1: "Rice, brown, long-grain, cooked",
  },
];

describe("golden-query ranking regression (ENG-807)", () => {
  it("covers at least 25 real queries", () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(25);
  });

  for (const g of GOLDEN) {
    it(`ranks "${g.query}" → top1 = "${g.top1}"`, () => {
      const ranked = rank(g.query, g.pool);
      expect(ranked[0]?.name).toBe(g.top1);
      if (g.top3) {
        const top3Names = ranked.slice(0, 3).map((r) => r.name);
        for (const expected of g.top3) {
          expect(top3Names).toContain(expected);
        }
      }
    });
  }

  it("never marks a USDA Branded mislabel as verified", () => {
    // "EGGS" (USDA Branded, verified:false) has perfect token overlap but is a
    // mislabelled packaged product — it must read estimated, not verified.
    expect(
      searchRowConfidenceTier({
        source: "USDA",
        verified: false,
        matchScore: searchMatchScore("eggs", "EGGS"),
      }),
    ).toBe("estimated");
  });

  it("marks the verified-generic top-1 as verified for whole-food queries", () => {
    for (const g of GOLDEN) {
      const ranked = rank(g.query, g.pool);
      const winner = ranked[0]!;
      if (winner.source === "USDA" && winner.verified) {
        const tier = searchRowConfidenceTier({
          source: winner.source,
          verified: winner.verified,
          matchScore: searchMatchScore(g.query, winner.name),
        });
        expect(tier, `${g.query} → ${winner.name}`).toBe("verified");
      }
    }
  });
});
