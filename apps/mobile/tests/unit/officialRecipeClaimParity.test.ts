import { describe, expect, it } from "vitest";

import {
  canShowOfficialVersion,
  isExactOfficialSourceMatch,
} from "@suppr/shared/recipes/officialRecipeClaim";

describe("official recipe claim parity", () => {
  it("uses exact source_url matching and never fuzzy matching", () => {
    expect(isExactOfficialSourceMatch("https://creator.test/post/1", "https://creator.test/post/1")).toBe(true);
    expect(isExactOfficialSourceMatch("https://creator.test/post/1", "https://creator.test/post/1/nearby")).toBe(false);
  });

  it("offers switch only for unclaimed private imports", () => {
    expect(canShowOfficialVersion({ currentRecipeId: "stub", sourceUrl: "https://creator.test/post/1", published: false, contentOrigin: "private_import" })).toBe(true);
    expect(canShowOfficialVersion({ currentRecipeId: "official", sourceUrl: "https://creator.test/post/1", published: true, contentOrigin: "claimed" })).toBe(false);
  });
});
