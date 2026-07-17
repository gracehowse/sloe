/**
 * ENG-1427 — integration coverage for the multi-candidate USDA fallback in
 * `verifyIngredients.ts` (the ENG-560 "top-2 in parallel + serial tail" block).
 *
 * Before this file the USDA branch's multi-candidate machinery had ZERO test
 * coverage: `verify-ingredients-usda-mock.test.ts` only ever feeds a SINGLE
 * search hit (accept / low-confidence skip / fdcId override), and
 * `fdcTwoStageFetch.test.ts` pins the SEARCH client's Foundation-vs-Branded
 * parallel fetch — a different layer entirely. Nothing exercised the case the
 * ENG-560 comment describes: several ranked hits where the top candidate fails
 * plausibility and a lower one must win, with the top 2 processed in parallel
 * and candidates 3+ served serially.
 *
 * This file adds:
 *  1. top-2 parallel — candidate #1 fails plausibility, candidate #2 (same
 *     parallel batch) wins;
 *  2. a falsifiable proof the top-2 detail fetches run CONCURRENTLY (a serial
 *     implementation would deadlock and time out);
 *  3. the parallel ordering contract — the highest-confidence acceptable match
 *     wins even when a lower-ranked candidate resolves first;
 *  4. serial tail — the parallel top-2 both fail and a position-3 tail
 *     candidate wins;
 *  5. Edamam multi-candidate fall-through — the top ranked hit fails
 *     plausibility and the next ranked candidate wins (the Edamam analogue of
 *     the FatSecret all-zero fall-through already covered in
 *     `verifyIngredientsRankedCandidates.test.ts`; Edamam only had RANKING
 *     coverage before, not fall-through-on-failure).
 *
 * Mocking mirrors `verifyIngredientsUsdaEdamamMicros.test.ts`: only the
 * providers under test are enabled via a controlled `serverEnv` mock, network
 * calls are mocked, and the REAL `usdaNormalize` / `macroPlausibility` gates
 * run so the fixtures exercise the genuine accept/reject logic. This is
 * TEST-ONLY — no production logic changed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FdcFood } from "@/lib/usda/fdcClient";

const mockFdcFoodsSearch = vi.fn();
const mockFdcFoodGet = vi.fn();
const mockEdamamFoodSearch = vi.fn();

vi.mock("@/lib/usda/fdcClient", () => ({
  fdcConfigFromEnv: () => ({ apiKey: "test-key" }),
  fdcFoodsSearch: (...args: unknown[]) => mockFdcFoodsSearch(...args),
  fdcFoodGet: (...args: unknown[]) => mockFdcFoodGet(...args),
}));

// Keep the real Edamam extractors; only override config + search so a
// controlled hit resolves (used by the Edamam fall-through fixture below).
vi.mock("@/lib/edamam/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/edamam/client")>();
  return {
    ...actual,
    edamamConfigFromEnv: () => ({ appId: "x", appKey: "y" }),
    edamamFoodSearch: (...args: unknown[]) => mockEdamamFoodSearch(...args),
  };
});

// OFF disabled — never let it resolve or hit the network.
vi.mock("@/lib/openFoodFacts/searchProducts", () => ({
  searchOffProducts: async () => [],
}));

// USDA + Edamam enabled; FatSecret + Suppr-DB off. Which provider resolves is
// then decided purely by which mock returns a hit.
vi.mock("@/lib/server/serverEnv", () => ({
  hasUsdaConfig: () => true,
  hasEdamamConfig: () => true,
  hasFatSecretConfig: () => false,
  hasSupabaseServiceConfig: () => false,
}));

import {
  verifyIngredients,
  confidenceForMatch,
  MIN_MATCH_CONFIDENCE,
} from "@/lib/nutrition/verifyIngredients";

// Non-curated, non-aliased query so the genericFoods/genericBeverages
// short-circuit and the NAME_ALIASES rewrites both leave it alone and the USDA
// branch is the resolver (same reasoning as verify-ingredients-usda-mock.test.ts).
const QUERY = "sirloin steak";

/**
 * A USDA detail row (the `fdcFoodGet` response). Only `foodNutrients` is read
 * by `processHit`; the returned row's name/id come from the SEARCH hit, so the
 * detail's own `fdcId`/`description` are intentionally irrelevant here.
 */
function usdaFood(
  energyKcal: number,
  macros?: { protein?: number; carbs?: number; fat?: number; sodium?: number },
): FdcFood {
  const { protein = 0, carbs = 0, fat = 0, sodium = 0 } = macros ?? {};
  return {
    fdcId: 0,
    description: "detail-row-name-unused",
    foodNutrients: [
      { nutrient: { name: "Energy", unitName: "KCAL" }, amount: energyKcal },
      { nutrient: { name: "Protein", unitName: "G" }, amount: protein },
      { nutrient: { name: "Carbohydrate, by difference", unitName: "G" }, amount: carbs },
      { nutrient: { name: "Total lipid (fat)", unitName: "G" }, amount: fat },
      { nutrient: { name: "Sodium, Na", unitName: "MG" }, amount: sodium },
    ],
  } as unknown as FdcFood;
}

/** Realistic sirloin panel — clears every plausibility gate. */
const GOOD = () => usdaFood(120, { protein: 23, fat: 2.6, sodium: 45 });
/** Corrupt row: >900 kcal/100g → rejected by `per100gPlausible`. */
const CORRUPT_KCAL = () => usdaFood(5000, { protein: 3 });
/** Corrupt row: kcal disagrees with 4/4/9 macros → rejected by `scaledMacrosPlausible`. */
const CORRUPT_ATWATER = () => usdaFood(100, { protein: 50, carbs: 50, fat: 50 });

function ingredients() {
  return [{ name: QUERY, amount: "100", unit: "g" }];
}

beforeEach(() => {
  mockFdcFoodsSearch.mockReset().mockResolvedValue([]);
  mockFdcFoodGet.mockReset();
  mockEdamamFoodSearch.mockReset().mockResolvedValue([]);
});

describe("verifyIngredients — USDA top-2 parallel fallback (ENG-1427 / ENG-560)", () => {
  it("returns candidate #2 when candidate #1 in the same parallel top-2 fails plausibility", async () => {
    // Two equally-named hits → the confidence tie is broken by USDA data-type
    // rank (Foundation ahead of SR Legacy), so both land in the parallel top-2.
    // Candidate #1's detail row is a corrupt >900 kcal/100g panel; candidate #2
    // is a clean sirloin panel and must win.
    const descA = "Sirloin steak, raw"; // Foundation → ranked #1
    const descB = "Sirloin steak, cooked"; // SR Legacy → ranked #2
    expect(confidenceForMatch(QUERY, descA)).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
    expect(confidenceForMatch(QUERY, descB)).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
    // Premise: identical name score, so ordering is decided by data-type rank.
    // If scoring ever makes these diverge, this assertion fails loudly rather
    // than the fixture silently ranking the wrong candidate first.
    expect(confidenceForMatch(QUERY, descB)).toBeCloseTo(confidenceForMatch(QUERY, descA), 10);

    mockFdcFoodsSearch.mockResolvedValue([
      { fdcId: 1001, description: descA, dataType: "Foundation" },
      { fdcId: 1002, description: descB, dataType: "SR Legacy" },
    ]);
    mockFdcFoodGet.mockImplementation(async (_cfg: unknown, fdcId: number) =>
      fdcId === 1001 ? CORRUPT_KCAL() : GOOD(),
    );

    const result = await verifyIngredients({ ingredients: ingredients(), servings: 1, provider: "auto" });

    const row = result.verified[0]!;
    expect(row.source).toBe("USDA");
    expect(row.matchedName).toBe(descB);
    expect(row.fatSecretFoodId).toBe("1002");
    expect(row.macros?.calories).toBe(120);
    // Both top-2 candidates were fetched — the signature of the parallel batch,
    // not a serial short-circuit that stops before candidate #2.
    expect(mockFdcFoodGet).toHaveBeenCalledWith(expect.anything(), 1001);
    expect(mockFdcFoodGet).toHaveBeenCalledWith(expect.anything(), 1002);
  });

  it("fires the top-2 detail fetches concurrently — a serial implementation would deadlock", async () => {
    // Candidate #1's fetch only settles once candidate #2's fetch has been
    // REQUESTED. Under the shipped Promise.all top-2 both fetches are in flight
    // at once, so requesting #2 settles #1. A hypothetical serial
    // `await processHit(#1)` before touching #2 would wait on #2 forever →
    // vitest would hit its timeout and this test would fail. That deadlock is
    // the falsifiable proof the two detail fetches genuinely run in parallel.
    const descA = "Sirloin steak, raw"; // Foundation → ranked #1, corrupt
    const descB = "Sirloin steak, cooked"; // SR Legacy → ranked #2, good
    mockFdcFoodsSearch.mockResolvedValue([
      { fdcId: 1001, description: descA, dataType: "Foundation" },
      { fdcId: 1002, description: descB, dataType: "SR Legacy" },
    ]);

    let resolveCandidate1!: (food: FdcFood) => void;
    const candidate1Fetched = new Promise<FdcFood>((res) => {
      resolveCandidate1 = res;
    });
    let candidate2Requested = false;

    mockFdcFoodGet.mockImplementation((_cfg: unknown, fdcId: number) => {
      if (fdcId === 1001) return candidate1Fetched; // stays pending until #2 is requested
      candidate2Requested = true;
      resolveCandidate1(CORRUPT_KCAL()); // unblock #1, which then fails plausibility
      return Promise.resolve(GOOD());
    });

    const result = await verifyIngredients({ ingredients: ingredients(), servings: 1, provider: "auto" });

    expect(candidate2Requested).toBe(true);
    const row = result.verified[0]!;
    expect(row.source).toBe("USDA");
    expect(row.matchedName).toBe(descB);
    expect(row.fatSecretFoodId).toBe("1002");
  });

  it("returns the highest-confidence acceptable match even when a lower-ranked candidate resolves first", async () => {
    // Both candidates resolve to clean panels, but the LOWER-ranked one's
    // detail fetch settles BEFORE the higher-ranked one's. Promise.all preserves
    // array (rank) order, so the pipeline must still return the higher-ranked
    // candidate — resolution timing must never decide the winner (ENG-560's
    // "returns the first highest-confidence acceptable match" contract).
    const descA = "Sirloin steak, raw"; // higher confidence → ranked #1
    const descB = "Sirloin steak, lean, raw"; // lower, still above the match floor
    const confA = confidenceForMatch(QUERY, descA);
    const confB = confidenceForMatch(QUERY, descB);
    expect(confB).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
    // Strict rank gap (> 0.02) so ranking is decided by confidence, not the
    // data-type tiebreak — A ranks #1 unambiguously.
    expect(confA).toBeGreaterThan(confB + 0.02);

    mockFdcFoodsSearch.mockResolvedValue([
      { fdcId: 1001, description: descA, dataType: "Foundation" },
      { fdcId: 1002, description: descB, dataType: "SR Legacy" },
    ]);

    let resolveCandidateA!: (food: FdcFood) => void;
    const candidateAFetched = new Promise<FdcFood>((res) => {
      resolveCandidateA = res;
    });
    mockFdcFoodGet.mockImplementation((_cfg: unknown, fdcId: number) => {
      if (fdcId === 1002) {
        // B (lower rank) resolves now; A is scheduled to resolve strictly after.
        void Promise.resolve().then(() =>
          resolveCandidateA(usdaFood(200, { protein: 20, carbs: 3, fat: 12 })),
        );
        return Promise.resolve(GOOD()); // B = 120 kcal
      }
      return candidateAFetched; // A = 200 kcal, resolves after B
    });

    const result = await verifyIngredients({ ingredients: ingredients(), servings: 1, provider: "auto" });

    const row = result.verified[0]!;
    expect(row.source).toBe("USDA");
    expect(row.matchedName).toBe(descA); // A wins on rank...
    expect(row.fatSecretFoodId).toBe("1001");
    expect(row.macros?.calories).toBe(200); // ...and it is A's panel, not B's 120
  });
});

describe("verifyIngredients — USDA serial-tail fallback (ENG-1427 / ENG-560)", () => {
  it("resolves via a position-3 tail candidate when both parallel top-2 candidates fail", async () => {
    // Three equally-named hits → data-type rank orders them
    // Foundation(#1) > SR Legacy(#2) > Survey(#3). Candidates #1 and #2 are the
    // parallel top-2 and BOTH fail plausibility (via two different gates — the
    // >900 kcal/100g ceiling and the 4/4/9 Atwater check). Candidate #3 is the
    // serial tail and the only clean panel, so it must win.
    const descA = "Sirloin steak, raw";
    const descB = "Sirloin steak, cooked";
    const descC = "Sirloin steak, roasted";
    for (const d of [descA, descB, descC]) {
      expect(confidenceForMatch(QUERY, d)).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
    }
    // Premise: all three score identically, so ranking is purely data-type-rank.
    expect(confidenceForMatch(QUERY, descB)).toBeCloseTo(confidenceForMatch(QUERY, descA), 10);
    expect(confidenceForMatch(QUERY, descC)).toBeCloseTo(confidenceForMatch(QUERY, descA), 10);

    mockFdcFoodsSearch.mockResolvedValue([
      { fdcId: 1001, description: descA, dataType: "Foundation" },
      { fdcId: 1002, description: descB, dataType: "SR Legacy" },
      { fdcId: 1003, description: descC, dataType: "Survey (FNDDS)" },
    ]);
    mockFdcFoodGet.mockImplementation(async (_cfg: unknown, fdcId: number) => {
      if (fdcId === 1001) return CORRUPT_KCAL(); // >900 kcal/100g → per100gPlausible reject
      if (fdcId === 1002) return CORRUPT_ATWATER(); // kcal ≠ 4/4/9 → scaledMacrosPlausible reject
      return GOOD(); // 1003 — clean, in the serial tail
    });

    const result = await verifyIngredients({ ingredients: ingredients(), servings: 1, provider: "auto" });

    const row = result.verified[0]!;
    expect(row.source).toBe("USDA");
    expect(row.matchedName).toBe(descC);
    expect(row.fatSecretFoodId).toBe("1003");
    expect(row.macros?.calories).toBe(120);
    // All three were fetched — top-2 in parallel plus the serial tail.
    expect(mockFdcFoodGet).toHaveBeenCalledWith(expect.anything(), 1001);
    expect(mockFdcFoodGet).toHaveBeenCalledWith(expect.anything(), 1002);
    expect(mockFdcFoodGet).toHaveBeenCalledWith(expect.anything(), 1003);
  });
});

describe("verifyIngredients — Edamam multi-candidate fall-through (ENG-1427)", () => {
  it("falls through to the next ranked Edamam candidate when the top hit fails plausibility", async () => {
    // USDA yields nothing so the chain falls to Edamam. The top-ranked Edamam
    // hit is a corrupt >900 kcal/100g row (rejected by per100gPlausible); the
    // pipeline must `continue` to the next ranked candidate rather than give up.
    // (Edamam previously had RANKING coverage but no fall-through-on-failure
    // coverage — that gap is what this fixture closes.)
    const query = "gochujang paste"; // non-curated; USDA returns nothing for it
    const topHit = {
      food: { foodId: "edamam-corrupt", label: "Gochujang paste", nutrients: { ENERC_KCAL: 5000, PROCNT: 3, FAT: 2, CHOCDF: 10 } },
    };
    const nextHit = {
      food: { foodId: "edamam-good", label: "Gochujang", nutrients: { ENERC_KCAL: 200, PROCNT: 6, FAT: 2, CHOCDF: 40 } },
    };
    const confTop = confidenceForMatch(query, topHit.food.label);
    const confNext = confidenceForMatch(query, nextHit.food.label);
    expect(confNext).toBeGreaterThanOrEqual(MIN_MATCH_CONFIDENCE);
    // The corrupt hit ranks first, so it is evaluated (and rejected) first.
    expect(confTop).toBeGreaterThan(confNext);

    mockFdcFoodsSearch.mockResolvedValue([]); // USDA misses → fall to Edamam
    mockEdamamFoodSearch.mockResolvedValue([topHit, nextHit]);

    const result = await verifyIngredients({
      ingredients: [{ name: query, amount: "100", unit: "g" }],
      servings: 1,
      provider: "auto",
    });

    const row = result.verified[0]!;
    expect(row.source).toBe("Edamam");
    expect(row.matchedName).toBe("Gochujang");
    expect(row.fatSecretFoodId).toBe("edamam-good");
    expect(row.macros?.calories).toBe(200);
  });
});
