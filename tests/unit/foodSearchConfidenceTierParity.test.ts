/**
 * ENG-807 — web ↔ mobile parity for the honest confidence tier + Best/More
 * section split.
 *
 * Both platforms MUST derive the per-row `confidenceTier` and the Best-matches
 * / More-results split from the SAME shared module (`foodSearchRanking.ts`), so
 * the two surfaces can never disagree about which rows are "Verified" or which
 * lead the list. This is a source-pin parity test in the style of
 * `foodSearchFatSecretMerge.test.ts` / `offPlausibilityGateParity.test.ts`: it
 * reads the data-layer source on each platform and asserts the wiring is
 * present and identical in shape.
 *
 * The behavioural correctness of the scorer / tier / split is covered by
 * `foodSearchRanking.test.ts` + `foodSearchRankingGolden.test.ts`; this file
 * guards the structural parity that a future refactor could silently break.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_VERIFY = resolve(__dirname, "../../apps/mobile/lib/verifyRecipe.ts");
const WEB_PANEL = resolve(
  __dirname,
  "../../src/app/components/food-search/FoodSearchPanel.tsx",
);
const RANKING = resolve(__dirname, "../../src/lib/nutrition/foodSearchRanking.ts");
const TRUST = resolve(__dirname, "../../src/lib/nutrition/searchRowTrust.ts");

const VERIFY_SRC = readFileSync(MOBILE_VERIFY, "utf8");
const WEB_SRC = readFileSync(WEB_PANEL, "utf8");
const RANKING_SRC = readFileSync(RANKING, "utf8");
const TRUST_SRC = readFileSync(TRUST, "utf8");

describe("ENG-807 — shared ranking module owns the tier + split", () => {
  it("exposes the strengthened scorer + tier + split helpers", () => {
    expect(RANKING_SRC).toMatch(/export function searchMatchScore/);
    expect(RANKING_SRC).toMatch(/export function searchRowConfidenceTier/);
    expect(RANKING_SRC).toMatch(/export function splitBestMatches/);
    expect(RANKING_SRC).toMatch(/export function foodSearchRankScore/);
  });

  it("derives the tier from BOTH provenance AND match score (never source alone)", () => {
    // The provenance check and a numeric score threshold must both appear in
    // searchRowConfidenceTier — guarding against a regression to source-only.
    expect(RANKING_SRC).toMatch(/hasVerifiableProvenance/);
    expect(RANKING_SRC).toMatch(/matchScore >= VERIFIED_TIER_MIN_SCORE/);
  });

  it("foodSearchRankScore supports the recently-logged tie-break boost", () => {
    expect(RANKING_SRC).toMatch(/recentlyLogged\?:\s*boolean/);
    expect(RANKING_SRC).toMatch(/RECENTLY_LOGGED_BOOST/);
  });

  it("trust module exposes the tier-keyed low-confidence demotion gate", () => {
    expect(TRUST_SRC).toMatch(/export function isLowConfidenceDemotedRow/);
    expect(TRUST_SRC).toMatch(/tier === "verified"/);
  });
});

describe("ENG-807 — mobile data layer wires the tier + split", () => {
  it("imports the shared tier + split helpers", () => {
    expect(VERIFY_SRC).toMatch(/searchRowConfidenceTier/);
    expect(VERIFY_SRC).toMatch(/splitBestMatches/);
    expect(VERIFY_SRC).toMatch(/searchMatchScore/);
  });

  it("stamps confidenceTier on every merged row", () => {
    expect(VERIFY_SRC).toMatch(/confidenceTier:\s*searchRowConfidenceTier\(\{/);
    expect(VERIFY_SRC).toMatch(/confidenceTier\?:\s*SearchRowConfidenceTier/);
  });

  it("applies the tier-keyed demotion gate in mergeResults", () => {
    expect(VERIFY_SRC).toMatch(/isLowConfidenceDemotedRow\(\{\s*tier,\s*score:\s*r\._relevance\s*\}\)/);
  });

  it("exports splitFoodSearchResults backed by the shared splitBestMatches", () => {
    expect(VERIFY_SRC).toMatch(/export function splitFoodSearchResults/);
    expect(VERIFY_SRC).toMatch(/return splitBestMatches\(/);
  });
});

describe("ENG-807 — web data layer wires the tier + split (parity)", () => {
  it("imports the shared tier + split helpers", () => {
    expect(WEB_SRC).toMatch(/searchRowConfidenceTier/);
    expect(WEB_SRC).toMatch(/splitBestMatches/);
    expect(WEB_SRC).toMatch(/searchMatchScore/);
  });

  it("stamps confidenceTier on every merged row", () => {
    expect(WEB_SRC).toMatch(/confidenceTier:\s*searchRowConfidenceTier\(\{/);
    expect(WEB_SRC).toMatch(/confidenceTier\?:\s*SearchRowConfidenceTier/);
  });

  it("applies the tier-keyed demotion gate in mergeAndDedup", () => {
    expect(WEB_SRC).toMatch(/isLowConfidenceDemotedRow\(\{\s*tier,\s*score:\s*r\._rel\s*as\s*number\s*\}\)/);
  });

  it("exports splitFoodSearchResults backed by the shared splitBestMatches", () => {
    expect(WEB_SRC).toMatch(/export function splitFoodSearchResults/);
    expect(WEB_SRC).toMatch(/return splitBestMatches\(/);
  });
});

describe("ENG-807 — runtime parity: identical tier for identical input", () => {
  it("web and mobile resolve the same tier from the shared helper", async () => {
    // Both platforms call the SAME `searchRowConfidenceTier`. Exercising it
    // directly is the strongest parity guarantee — there is one implementation.
    const { searchRowConfidenceTier, searchMatchScore } = await import(
      "@/lib/nutrition/foodSearchRanking"
    );
    const cases: Array<{
      source: "USDA" | "OFF" | "Edamam" | "FatSecret" | "GenericFood";
      verified: boolean;
      query: string;
      name: string;
      expected: "verified" | "estimated";
    }> = [
      { source: "USDA", verified: true, query: "eggs", name: "Eggs, Grade A, Large, egg whole", expected: "verified" },
      { source: "USDA", verified: false, query: "eggs", name: "EGGS", expected: "estimated" },
      { source: "OFF", verified: false, query: "yogurt", name: "Brand · Greek Yogurt", expected: "estimated" },
      { source: "FatSecret", verified: false, query: "big mac", name: "McDonald's · Big Mac", expected: "estimated" },
      { source: "GenericFood", verified: true, query: "apple", name: "Apple", expected: "verified" },
    ];
    for (const c of cases) {
      const tier = searchRowConfidenceTier({
        source: c.source,
        verified: c.verified,
        matchScore: searchMatchScore(c.query, c.name),
      });
      expect(tier, `${c.query} → ${c.name}`).toBe(c.expected);
    }
  });
});
