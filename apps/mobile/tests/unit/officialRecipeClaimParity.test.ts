import { describe, expect, it } from "vitest";

import {
  canShowOfficialVersion,
  officialMacrosClaimBlocker,
  isExactOfficialSourceMatch,
} from "@suppr/shared/recipes/officialRecipeClaim";

describe("official recipe claim parity", () => {
  it("uses exact source_url matching and never fuzzy matching", () => {
    expect(isExactOfficialSourceMatch("https://creator.test/post/1", "https://creator.test/post/1")).toBe(true);
    expect(isExactOfficialSourceMatch("https://creator.test/post/1", "https://creator.test/post/1/nearby")).toBe(false);
  });

  it("offers switch only for unclaimed private imports", () => {
    expect(canShowOfficialVersion({ currentRecipeId: "stub", sourceUrl: "https://creator.test/post/1", published: false, contentOrigin: "imported_stub" })).toBe(true);
    expect(canShowOfficialVersion({ currentRecipeId: "official", sourceUrl: "https://creator.test/post/1", published: true, contentOrigin: "claimed" })).toBe(false);
  });

  it("shares Claim → Official eligibility with web", () => {
    expect(officialMacrosClaimBlocker({
      isOwner: true,
      published: true,
      contentOrigin: "first_party",
      sourceUrl: "https://creator.test/post/1",
      ingredientCount: 2,
      verifiedIngredientCount: 2,
    })).toBeNull();
    expect(officialMacrosClaimBlocker({
      isOwner: true,
      published: true,
      contentOrigin: "first_party",
      sourceUrl: "https://creator.test/post/1",
      ingredientCount: 2,
      verifiedIngredientCount: 1,
    })).toBe("unverified_ingredients");
  });
});
