import { describe, expect, it } from "vitest";
import { DISCOVER_POPULAR_MIN_SAVES } from "../../src/lib/recipes/fetchPublicRecipeSaveCounts";
import { discoverQualifiesAsPopular } from "../../src/lib/recipes/discoverPopularQualification";

describe("discoverQualifiesAsPopular (ENG-1202)", () => {
  it("passes catalog editorial seeds regardless of save count", () => {
    expect(
      discoverQualifiesAsPopular({
        id: "seed-v2-mediterranean-greek-salad",
        saves: 0,
        feedSource: "catalog",
      }),
    ).toBe(true);
  });

  it("passes seed ids even when feedSource is omitted", () => {
    expect(
      discoverQualifiesAsPopular({
        id: "seed-v2-asian-miso-ramen",
        savedCount: 0,
      }),
    ).toBe(true);
  });

  it("requires community recipes to meet the global save threshold", () => {
    expect(
      discoverQualifiesAsPopular({
        id: "community-uuid",
        saves: DISCOVER_POPULAR_MIN_SAVES - 1,
        feedSource: "community",
      }),
    ).toBe(false);
    expect(
      discoverQualifiesAsPopular({
        id: "community-uuid",
        saves: DISCOVER_POPULAR_MIN_SAVES,
        feedSource: "community",
      }),
    ).toBe(true);
  });
});
