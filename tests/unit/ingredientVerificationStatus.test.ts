/**
 * Tests for `deriveIngredientVerificationTier` and
 * `ingredientShouldShowVerifyCta` — the recipe-detail row label/CTA
 * helpers that fix the "still says partial match even when I have
 * updated it myself" bug seen in user testing on 2026-05-02.
 *
 * The recipe-detail row UI used to derive its label and Verify CTA
 * solely from the numeric `confidence` column. When a user manually
 * verified a row through the verify flow we wrote `is_verified=true`
 * and `source='USDA'` but did NOT update the stale `confidence` (e.g.
 * 0.69 from the original AI parse). The row then rendered "69% ·
 * Partial match" + a Verify CTA forever.
 *
 * The shared helper here is the source of truth for the post-fix
 * label/CTA decision. Persistence of `confidence` is also fixed in
 * `apps/mobile/lib/verifyRecipe.ts` and the inline web verify-update
 * in `src/app/components/RecipeDetail.tsx` so the stored row state
 * agrees with the user's resolution going forward; this helper
 * additionally protects historical rows where the persisted
 * `confidence` is out of sync.
 */

import { describe, expect, it } from "vitest";
import {
  deriveIngredientVerificationTier,
  ingredientShouldShowVerifyCta,
} from "@/lib/recipe-ingredients/ingredientVerificationStatus";

describe("deriveIngredientVerificationTier", () => {
  it("returns 'verified' when is_verified is true regardless of confidence", () => {
    // The user-reported bug: confidence stayed at 0.69 after a manual
    // verify that flipped is_verified to true. Helper trusts the flag.
    expect(
      deriveIngredientVerificationTier({
        isVerified: true,
        confidence: 0.69,
        source: "USDA",
      }),
    ).toBe("verified");
  });

  it("returns 'verified' when source is trusted even if is_verified is null", () => {
    // Belt-and-braces for legacy rows where is_verified was not flipped
    // despite the row coming from a verified database source.
    expect(
      deriveIngredientVerificationTier({
        isVerified: null,
        confidence: 0.6,
        source: "USDA",
      }),
    ).toBe("verified");

    expect(
      deriveIngredientVerificationTier({
        isVerified: null,
        confidence: 0.6,
        source: "FatSecret",
      }),
    ).toBe("verified");

    expect(
      deriveIngredientVerificationTier({
        isVerified: null,
        confidence: 0.6,
        source: "OFF",
      }),
    ).toBe("verified");

    expect(
      deriveIngredientVerificationTier({
        isVerified: null,
        confidence: 0.6,
        source: "Edamam",
      }),
    ).toBe("verified");
  });

  it("ENG-1425 — caps the untrusted-source fallback at 'partial' even at a high confidence score, so the Verify CTA stays visible", () => {
    // Was "verified" (green, no CTA) pre-fix — the conf-2 audit finding:
    // a bare confidence score from an unspecified/untrusted source must
    // not be granted the strongest trust treatment.
    const tier = deriveIngredientVerificationTier({
      isVerified: null,
      confidence: 0.92,
      source: null,
    });
    expect(tier).toBe("partial");
    expect(ingredientShouldShowVerifyCta(tier)).toBe(true);
  });

  it("ENG-1425 — untrusted-source row at exactly 0.75 confidence shows 'partial' + Verify CTA, not silently 'verified'", () => {
    const tier = deriveIngredientVerificationTier({
      isVerified: false,
      confidence: 0.75,
      source: "ai",
    });
    expect(tier).toBe("partial");
    expect(ingredientShouldShowVerifyCta(tier)).toBe(true);
  });

  it("ENG-1425 — untrusted-source row at very high confidence (0.99) still caps at 'partial', not 'verified'", () => {
    const tier = deriveIngredientVerificationTier({
      isVerified: false,
      confidence: 0.99,
      source: "OpenAI import",
    });
    expect(tier).toBe("partial");
    expect(ingredientShouldShowVerifyCta(tier)).toBe(true);
  });

  it("ENG-1425 — trusted-source rows are unaffected by the cap: still 'verified' with no CTA regardless of confidence", () => {
    // Same fixtures as the pre-existing trusted-source test, re-asserted
    // here to pin that ENG-1425 did not touch this branch.
    for (const source of ["USDA", "FatSecret", "OFF", "Edamam", "manual"]) {
      const tier = deriveIngredientVerificationTier({
        isVerified: null,
        confidence: 0.6,
        source,
      });
      expect(tier).toBe("verified");
      expect(ingredientShouldShowVerifyCta(tier)).toBe(false);
    }

    // A trusted source at a high confidence should also still be
    // "verified" — the cap only applies to the untrusted fallback.
    const highConfidenceTrusted = deriveIngredientVerificationTier({
      isVerified: null,
      confidence: 0.95,
      source: "USDA",
    });
    expect(highConfidenceTrusted).toBe("verified");
    expect(ingredientShouldShowVerifyCta(highConfidenceTrusted)).toBe(false);
  });

  it("ENG-1425 — is_verified=true rows are unaffected by the cap: still 'verified' with no CTA regardless of confidence or source", () => {
    const tier = deriveIngredientVerificationTier({
      isVerified: true,
      confidence: 0.99,
      source: "AI",
    });
    expect(tier).toBe("verified");
    expect(ingredientShouldShowVerifyCta(tier)).toBe(false);
  });

  it("returns 'partial' for unverified rows with confidence >= 0.55 (e.g. 0.69)", () => {
    expect(
      deriveIngredientVerificationTier({
        isVerified: false,
        confidence: 0.69,
        source: "ai",
      }),
    ).toBe("partial");
  });

  it("returns 'estimated' for unverified rows with confidence in (0, 0.55)", () => {
    expect(
      deriveIngredientVerificationTier({
        isVerified: false,
        confidence: 0.3,
        source: "ai",
      }),
    ).toBe("estimated");
  });

  it("ENG-1431 — 0.50-0.549 no longer reads 'partial' (was a contradiction: MIN_ACCEPT_CONFIDENCE also rejects this band)", () => {
    expect(
      deriveIngredientVerificationTier({
        isVerified: false,
        confidence: 0.5,
        source: "ai",
      }),
    ).toBe("estimated");
    expect(
      deriveIngredientVerificationTier({
        isVerified: false,
        confidence: 0.549,
        source: "ai",
      }),
    ).toBe("estimated");
  });

  it("returns 'unverified' when confidence is null and source is untrusted", () => {
    expect(
      deriveIngredientVerificationTier({
        isVerified: null,
        confidence: null,
        source: null,
      }),
    ).toBe("unverified");

    expect(
      deriveIngredientVerificationTier({
        isVerified: false,
        confidence: null,
        source: "Local estimate",
      }),
    ).toBe("unverified");
  });

  it("treats the 0.55 partial-floor boundary inclusively; 0.75 is no longer a distinct boundary post-ENG-1425 (both bucket to 'partial' in the untrusted fallback)", () => {
    expect(
      deriveIngredientVerificationTier({
        isVerified: false,
        confidence: 0.75,
        source: null,
      }),
    ).toBe("partial");

    expect(
      deriveIngredientVerificationTier({
        isVerified: false,
        confidence: 0.55,
        source: null,
      }),
    ).toBe("partial");
  });

  it("ignores stale confidence when is_verified=true (user-reported bug pin)", () => {
    // Pin the exact symptom from the user report: row shows
    // "69% · Partial match" even after manual verify.
    const tier = deriveIngredientVerificationTier({
      isVerified: true,
      confidence: 0.69,
      source: "USDA",
    });
    expect(tier).toBe("verified");
    expect(ingredientShouldShowVerifyCta(tier)).toBe(false);
  });
});

describe("ingredientShouldShowVerifyCta", () => {
  it("hides the CTA on verified rows", () => {
    expect(ingredientShouldShowVerifyCta("verified")).toBe(false);
  });

  it("shows the CTA on partial / estimated / unverified rows", () => {
    expect(ingredientShouldShowVerifyCta("partial")).toBe(true);
    expect(ingredientShouldShowVerifyCta("estimated")).toBe(true);
    expect(ingredientShouldShowVerifyCta("unverified")).toBe(true);
  });
});
