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

  it("ENG-1425 — untrusted confidence >= 0.75 caps at 'partial' (Verify CTA stays)", () => {
    expect(
      deriveIngredientVerificationTier({
        isVerified: null,
        confidence: 0.92,
        source: null,
      }),
    ).toBe("partial");
    expect(
      deriveIngredientVerificationTier({
        isVerified: false,
        confidence: 0.75,
        source: "ai",
      }),
    ).toBe("partial");
  });

  it("returns 'partial' for unverified rows with confidence in [0.55, 0.75)", () => {
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

  it("treats numeric confidence boundaries inclusively at 0.55 (ENG-1425: 0.75 no longer verified for untrusted)", () => {
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
