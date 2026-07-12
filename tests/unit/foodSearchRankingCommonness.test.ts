/**
 * Commonness / popularity prior regression (ENG-1531).
 *
 * A bare generic-food query ("chicken", "beef", "pork") should surface the
 * ordinary cut, never an organ/offal/trimming variant. Before ENG-1531 the
 * scorer floated those to the top — "Chicken skin" (recall 1, and "skin" is a
 * NEUTRAL_DESCRIPTOR so precision 1) plus the +0.10 USDA-verified trust bump
 * out-ranked "Chicken, … breast, meat only, raw", and "Chicken feet" tied it.
 *
 * `uncommonCutQueryPenalty` (in the shared, mobile-re-exported ranking module)
 * demotes those cuts UNLESS the query names them. These fixtures pin the fix on
 * BOTH platforms (web `mergeAndDedup` + mobile `mergeResults` call the same
 * `foodSearchRankScore`). Each case is a deterministic synthetic pool — no live
 * API. If a legitimate scorer change moves an expectation, update it here in the
 * same change; never silence the test.
 */
import { describe, expect, it } from "vitest";

import {
  foodSearchRankScore,
  uncommonCutQueryPenalty,
  type FoodSearchTrustSource,
} from "@/lib/nutrition/foodSearchRanking";

type Candidate = { name: string; source: FoodSearchTrustSource; verified?: boolean };

function rank(query: string, pool: Candidate[]): Candidate[] {
  return [...pool].sort(
    (a, b) =>
      foodSearchRankScore({ query, name: b.name, source: b.source, verified: b.verified }) -
      foodSearchRankScore({ query, name: a.name, source: a.source, verified: a.verified }),
  );
}

/**
 * Top-20 generic-food cases. `winner` is the ordinary cut; every name in
 * `offal` is an organ/offal/skin/feet/gizzard variant that must rank BELOW it.
 * The winner must also be #1 in the pool.
 */
const OFFAL_DEMOTION: Array<{ query: string; winner: string; offal: string[] }> = [
  { query: "chicken", winner: "Chicken, broilers or fryers, breast, meat only, raw", offal: ["Chicken skin", "Chicken feet"] },
  { query: "chicken", winner: "Chicken, broilers or fryers, breast, meat only, raw", offal: ["Chicken, gizzard, all classes, raw", "Chicken, liver, all classes, raw"] },
  { query: "beef", winner: "Beef, chuck, raw", offal: ["Beef, liver, raw", "Beef, tripe, raw"] },
  { query: "beef", winner: "Beef, round, raw", offal: ["Beef, tongue, raw", "Beef, kidneys, raw"] },
  { query: "pork", winner: "Pork, loin, raw", offal: ["Pork, skin, raw", "Pork, chitterlings, raw"] },
  { query: "pork", winner: "Pork, loin, raw", offal: ["Pork, liver, raw", "Pork, kidneys, raw"] },
  { query: "turkey", winner: "Turkey, breast, raw", offal: ["Turkey, gizzard, raw", "Turkey, neck, raw"] },
  { query: "turkey", winner: "Turkey, breast, raw", offal: ["Turkey, giblets, raw", "Turkey, liver, raw"] },
  { query: "lamb", winner: "Lamb, leg, raw", offal: ["Lamb, liver, raw", "Lamb, kidneys, raw"] },
  { query: "lamb", winner: "Lamb, loin, raw", offal: ["Lamb, heart, raw", "Lamb, tongue, raw"] },
  { query: "duck", winner: "Duck, breast, raw", offal: ["Duck, liver, raw", "Duck skin"] },
  { query: "veal", winner: "Veal, loin, raw", offal: ["Veal, liver, raw", "Veal, tongue, raw"] },
  { query: "goose", winner: "Goose, meat only, raw", offal: ["Goose, liver, raw"] },
  { query: "salmon", winner: "Fish, salmon, Atlantic, wild, raw", offal: ["Salmon skin"] },
  { query: "cod", winner: "Fish, cod, Atlantic, raw", offal: ["Fish, cod, liver, raw"] },
  { query: "egg", winner: "Egg, whole, raw, fresh", offal: ["Egg, yolk, raw, fresh"] },
  { query: "rabbit", winner: "Rabbit, meat only, raw", offal: ["Rabbit, liver, raw"] },
  { query: "goat", winner: "Goat, meat only, raw", offal: ["Goat, liver, raw"] },
  { query: "bison", winner: "Bison, chuck, raw", offal: ["Bison, liver, raw"] },
  { query: "haddock", winner: "Fish, haddock, raw", offal: ["Fish, haddock, liver, raw"] },
];

describe("commonness prior — offal/skin demotion for generic queries (ENG-1531)", () => {
  it("covers at least 20 generic-food queries", () => {
    expect(OFFAL_DEMOTION.length).toBeGreaterThanOrEqual(20);
  });

  for (const c of OFFAL_DEMOTION) {
    it(`"${c.query}" ranks the ordinary cut above ${c.offal.join(" / ")}`, () => {
      const pool: Candidate[] = [
        { name: c.winner, source: "USDA", verified: true },
        ...c.offal.map((name) => ({ name, source: "USDA" as const, verified: true })),
      ];
      const ranked = rank(c.query, pool);
      // The plain cut is the top result, and every offal variant sits below it.
      expect(ranked[0]?.name).toBe(c.winner);
      const winnerScore = foodSearchRankScore({ query: c.query, name: c.winner, source: "USDA", verified: true });
      for (const offal of c.offal) {
        const offalScore = foodSearchRankScore({ query: c.query, name: offal, source: "USDA", verified: true });
        expect(winnerScore, `${c.query}: "${c.winner}" > "${offal}"`).toBeGreaterThan(offalScore);
      }
    });
  }
});

describe("uncommonCutQueryPenalty — guards (ENG-1531)", () => {
  it("demotes an unrequested offal/skin/feet cut", () => {
    expect(uncommonCutQueryPenalty({ query: "chicken", name: "Chicken skin" })).toBeLessThan(0);
    expect(uncommonCutQueryPenalty({ query: "chicken", name: "Chicken feet" })).toBeLessThan(0);
    expect(uncommonCutQueryPenalty({ query: "beef", name: "Beef, liver, raw" })).toBeLessThan(0);
  });

  it("does not demote the ordinary cut (no cut word present)", () => {
    expect(
      uncommonCutQueryPenalty({
        query: "chicken",
        name: "Chicken, broilers or fryers, breast, meat only, raw",
      }),
    ).toBe(0);
  });

  it("exempts a cut the query explicitly names", () => {
    expect(
      uncommonCutQueryPenalty({ query: "chicken liver", name: "Chicken, liver, all classes, raw" }),
    ).toBe(0);
    expect(uncommonCutQueryPenalty({ query: "beef heart", name: "Beef, heart, raw" })).toBe(0);
    expect(uncommonCutQueryPenalty({ query: "beef tongue", name: "Beef, tongue, raw" })).toBe(0);
  });

  it("exempts plant/legume foods that share an organ homonym", () => {
    // kidney BEANS, BLOOD orange, heart of PALM, ARTICHOKE hearts.
    expect(
      uncommonCutQueryPenalty({ query: "beans", name: "Beans, kidney, mature seeds, cooked" }),
    ).toBe(0);
    expect(uncommonCutQueryPenalty({ query: "orange", name: "Blood orange, raw" })).toBe(0);
    expect(uncommonCutQueryPenalty({ query: "palm", name: "Hearts of palm, raw" })).toBe(0);
    expect(
      uncommonCutQueryPenalty({ query: "artichoke", name: "Artichoke hearts, marinated" }),
    ).toBe(0);
  });

  it("exempts a cut used as a whole-food modifier (with / without / and)", () => {
    expect(uncommonCutQueryPenalty({ query: "apple", name: "Apples, raw, with skin" })).toBe(0);
    expect(uncommonCutQueryPenalty({ query: "apple", name: "Apples, raw, without skin" })).toBe(0);
    expect(
      uncommonCutQueryPenalty({
        query: "chicken",
        name: "Chicken, broilers or fryers, meat and skin, raw",
      }),
    ).toBe(0);
  });

  it("exempts a butchery skin-on cut (skin attached to the meat)", () => {
    // "skin-on" (normalized "skin on") is an ordinary cut, not skin-as-food.
    expect(
      uncommonCutQueryPenalty({ query: "chicken", name: "Chicken thigh, skin-on, bone-in, raw" }),
    ).toBe(0);
    // "skinless" is a neutral descriptor, never the cut word "skin".
    expect(
      uncommonCutQueryPenalty({ query: "chicken", name: "Chicken breast, boneless, skinless, raw" }),
    ).toBe(0);
  });

  it("leaves the UK-retailer lane untouched (retailer query → no stacked penalty)", () => {
    // ukRetailerQueryUsdaPenalty owns "tesco chicken" → "Chicken skin"; the
    // commonness prior must not stack a second demotion on top.
    expect(uncommonCutQueryPenalty({ query: "tesco chicken", name: "Chicken skin" })).toBe(0);
  });

  it("keeps the retailer-query outcome correct end-to-end", () => {
    const branded = foodSearchRankScore({
      query: "tesco chicken",
      name: "Tesco · British Chicken Breast Fillets",
      source: "FatSecret",
    });
    const usdaSkin = foodSearchRankScore({
      query: "tesco chicken",
      name: "Chicken skin",
      source: "USDA",
      verified: true,
    });
    expect(branded).toBeGreaterThan(usdaSkin);
  });
});
