import { describe, expect, it } from "vitest";

import {
  OFFICIAL_MACROS_CLAIM_BLOCKER_COPY,
  canShowOfficialVersion,
  officialMacrosClaimBlocker,
  claimVerificationIsVerified,
  isExactOfficialSourceMatch,
} from "@/lib/recipes/officialRecipeClaim";

describe("official recipe claim helpers", () => {
  it("matches official versions only by exact source_url", () => {
    expect(isExactOfficialSourceMatch("https://example.com/r", "https://example.com/r")).toBe(true);
    expect(isExactOfficialSourceMatch("https://example.com/r", "https://example.com/r?utm=x")).toBe(false);
    expect(isExactOfficialSourceMatch("https://example.com/r", "https://example.com/other")).toBe(false);
    expect(isExactOfficialSourceMatch(null, "https://example.com/r")).toBe(false);
  });

  it("only offers the official badge for private imported stubs", () => {
    expect(canShowOfficialVersion({ currentRecipeId: "stub", sourceUrl: "https://example.com/r", published: false, contentOrigin: "imported_stub" })).toBe(true);
    expect(canShowOfficialVersion({ currentRecipeId: "official", sourceUrl: "https://example.com/r", published: true, contentOrigin: "claimed" })).toBe(false);
    expect(canShowOfficialVersion({ currentRecipeId: "draft", sourceUrl: null, published: false, contentOrigin: "imported_stub" })).toBe(false);
  });

  it("rejects self-serve or attestation-only claim attempts", () => {
    expect(claimVerificationIsVerified({ method: "self_serve", source_url: "https://example.com/r", verified_at: "2026-06-19T00:00:00Z", attestation: true })).toBe(false);
    expect(claimVerificationIsVerified({ method: "bio_code", source_url: "https://example.com/r", attestation: true })).toBe(false);
    expect(claimVerificationIsVerified({ method: "dns_meta", source_url: "https://example.com/r", verified_at: "2026-06-19T00:00:00Z", attestation: true })).toBe(true);
  });

  it("requires owner, public source, and fully verified ingredients before Claim → Official", () => {
    const base = {
      isOwner: true,
      published: true,
      contentOrigin: "first_party",
      sourceUrl: "https://example.com/r",
      ingredientCount: 3,
      verifiedIngredientCount: 3,
    };

    expect(officialMacrosClaimBlocker(base)).toBeNull();
    expect(officialMacrosClaimBlocker({ ...base, isOwner: false })).toBe("not_owner");
    expect(officialMacrosClaimBlocker({ ...base, published: false })).toBe("not_public");
    expect(officialMacrosClaimBlocker({ ...base, sourceUrl: "" })).toBe("missing_source");
    expect(officialMacrosClaimBlocker({ ...base, ingredientCount: 0, verifiedIngredientCount: 0 })).toBe("no_ingredients");
    expect(officialMacrosClaimBlocker({ ...base, verifiedIngredientCount: 2 })).toBe("unverified_ingredients");
    expect(OFFICIAL_MACROS_CLAIM_BLOCKER_COPY.unverified_ingredients).toContain("Verify every ingredient");
  });
});
