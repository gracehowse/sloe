/**
 * F-89 + F-90 (2026-04-25) — pin defence-in-depth filters.
 *
 * F-89: tester searched "egg" / "eggs" and after F-77/F-87 still saw a
 *       row called just "Egg" or "Eggs" at 525 kcal/100g. The macros
 *       were internally consistent (passed Atwater) but the row was
 *       a misnamed Edamam product, not a chicken egg. Dropped on the
 *       basis that verified USDA always carries modifiers ("Eggs,
 *       Grade A, Large, egg whole") and a bare noun from a non-verified
 *       source is suspect.
 *
 * F-90: tester searched "eggs" and saw "Cacio E Pepe Ravioli" because
 *       Edamam tagged it as containing eggs. Dropped via minimum
 *       relevance threshold for non-verified rows.
 */
import { describe, expect, it } from "vitest";
import {
  isBareGenericNounRow,
  isLowRelevanceNonVerifiedRow,
  isLowConfidenceDemotedRow,
  LOW_CONFIDENCE_DEMOTE_SCORE,
} from "@/lib/nutrition/searchRowTrust";

describe("F-89 — bare generic-noun unverified filter", () => {
  it("drops 'Egg' / 'Eggs' / 'Banana' from non-verified sources", () => {
    expect(isBareGenericNounRow("Egg", false)).toBe(true);
    expect(isBareGenericNounRow("Eggs", false)).toBe(true);
    expect(isBareGenericNounRow("Banana", false)).toBe(true);
    expect(isBareGenericNounRow("Chicken", false)).toBe(true);
  });

  it("keeps verified USDA bare-noun rows (Foundation 'Eggs' as a generic class is impossible — but exempt anyway)", () => {
    expect(isBareGenericNounRow("Eggs", true)).toBe(false);
    expect(isBareGenericNounRow("Banana", true)).toBe(false);
  });

  it("keeps non-verified rows with modifiers / commas / parentheticals", () => {
    expect(isBareGenericNounRow("Eggs, Grade A, Large, egg whole", false)).toBe(false);
    expect(isBareGenericNounRow("Egg, Benedict", false)).toBe(false);
    expect(isBareGenericNounRow("Bananas, raw", false)).toBe(false);
    expect(isBareGenericNounRow("Banana (overripe)", false)).toBe(false);
    expect(isBareGenericNounRow("Banana bread", false)).toBe(false);
  });

  it("strips OFF brand prefix before evaluating", () => {
    // "Lidl · Eggs" — brand row, the post-brand part is bare noun BUT
    // the brand presence indicates a real packaged product. Drop the
    // bare-noun part if branded? Actually treat brand rows as kept —
    // a branded "Eggs" is still a real (if oddly named) product.
    // The helper strips brand and checks just the suffix; if suffix is
    // bare noun, drops. Choose to drop (rare for legitimate brands).
    expect(isBareGenericNounRow("Lidl · Eggs", false)).toBe(true);
    // Brand + non-bare descriptive name keeps.
    expect(isBareGenericNounRow("Lidl · Free Range Eggs", false)).toBe(false);
  });

  it("does not drop multi-word common-food display names", () => {
    expect(isBareGenericNounRow("Egg whites", false)).toBe(false);
    expect(isBareGenericNounRow("Egg salad", false)).toBe(false);
    expect(isBareGenericNounRow("Hard boiled egg", false)).toBe(false);
  });

  it("ignores empty / undefined names safely", () => {
    expect(isBareGenericNounRow("", false)).toBe(false);
    expect(isBareGenericNounRow("   ", false)).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(isBareGenericNounRow("EGG", false)).toBe(true);
    expect(isBareGenericNounRow("eggs", false)).toBe(true);
    expect(isBareGenericNounRow("CHICKEN", false)).toBe(true);
  });
});

describe("F-90 — low-relevance non-verified filter", () => {
  it("drops non-verified rows with relevance < 0.30", () => {
    expect(isLowRelevanceNonVerifiedRow(0.15, false)).toBe(true);
    expect(isLowRelevanceNonVerifiedRow(0.0, false)).toBe(true);
    expect(isLowRelevanceNonVerifiedRow(0.29, false)).toBe(true);
  });

  it("keeps non-verified rows above the threshold", () => {
    expect(isLowRelevanceNonVerifiedRow(0.30, false)).toBe(false);
    expect(isLowRelevanceNonVerifiedRow(0.7, false)).toBe(false);
    expect(isLowRelevanceNonVerifiedRow(1.0, false)).toBe(false);
  });

  it("never drops verified rows regardless of relevance", () => {
    expect(isLowRelevanceNonVerifiedRow(0.0, true)).toBe(false);
    expect(isLowRelevanceNonVerifiedRow(0.15, true)).toBe(false);
  });
});

describe("ENG-807 — honest low-confidence demotion (tier-keyed)", () => {
  it("drops estimated-tier rows below the demote score", () => {
    expect(isLowConfidenceDemotedRow({ tier: "estimated", score: 0.15 })).toBe(true);
    expect(isLowConfidenceDemotedRow({ tier: "estimated", score: 0.0 })).toBe(true);
    expect(
      isLowConfidenceDemotedRow({ tier: "estimated", score: LOW_CONFIDENCE_DEMOTE_SCORE - 0.01 }),
    ).toBe(true);
  });

  it("keeps estimated-tier rows at/above the demote score", () => {
    expect(
      isLowConfidenceDemotedRow({ tier: "estimated", score: LOW_CONFIDENCE_DEMOTE_SCORE }),
    ).toBe(false);
    expect(isLowConfidenceDemotedRow({ tier: "estimated", score: 0.7 })).toBe(false);
  });

  it("never drops verified-tier rows regardless of score", () => {
    expect(isLowConfidenceDemotedRow({ tier: "verified", score: 0.0 })).toBe(false);
    expect(isLowConfidenceDemotedRow({ tier: "verified", score: 0.1 })).toBe(false);
  });

  it("is a strict superset of the raw-flag gate at the same threshold", () => {
    // Same boundary as F-90 so already-filtered rows are unaffected; the gate
    // adds coverage for estimated-tier rows the raw `verified` flag let through.
    expect(LOW_CONFIDENCE_DEMOTE_SCORE).toBe(0.3);
  });
});
