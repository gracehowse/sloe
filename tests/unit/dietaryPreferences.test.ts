import { describe, expect, it } from "vitest";
import {
  DIETARY_PREFERENCE_ENTRIES,
  normaliseDietaryFromProfile,
} from "../../src/constants/dietaryPreferences.ts";

describe("normaliseDietaryFromProfile", () => {
  it("returns empty for non-array", () => {
    expect(normaliseDietaryFromProfile(null)).toEqual([]);
    expect(normaliseDietaryFromProfile({})).toEqual([]);
  });

  it("keeps only known ids in order", () => {
    expect(
      normaliseDietaryFromProfile(["vegan", "unknown-tag", "halal", 3, "vegetarian"]),
    ).toEqual(["vegan", "halal", "vegetarian"]);
  });
});

describe("DIETARY_PREFERENCE_ENTRIES", () => {
  it("has unique ids", () => {
    const ids = DIETARY_PREFERENCE_ENTRIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
