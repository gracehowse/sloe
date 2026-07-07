/**
 * mergeFetchedMicrosPer100g — shared multi-source micros-merge
 * (ENG-1362, round 2 of the ENG-550 FoodSearchPanel extraction).
 *
 * Both panels merge a search hit's minimal inline micros (fiber/sugar/
 * sodium from the search route) with a richer on-select vendor detail
 * fetch (e.g. Edamam's `/nutrients` full panel). This pins that merge's
 * contract before + after the extraction: the fetch wins on overlap, a
 * failed/partial fetch never drops what the search hit already had, and
 * implausible values are clamped out either way.
 */
import { describe, expect, it } from "vitest";
import { mergeFetchedMicrosPer100g } from "../../src/lib/nutrition/foodSearchMicrosMerge";

describe("mergeFetchedMicrosPer100g", () => {
  it("merges a richer fetched panel over the search hit's minimal panel for a multi-source result", () => {
    const existing = { fiberG: 2, sugarG: 3, sodiumMg: 400 };
    const fetched = { fiberG: 2.4, sugarG: 3.1, sodiumMg: 410, cholesterolMg: 12, vitaminCMg: 5 };
    const merged = mergeFetchedMicrosPer100g(existing, fetched);
    expect(merged).toEqual({
      fiberG: 2.4,
      sugarG: 3.1,
      sodiumMg: 410,
      cholesterolMg: 12,
      vitaminCMg: 5,
    });
  });

  it("keeps the search hit's existing micros when the detail fetch returns {} (failure)", () => {
    const existing = { fiberG: 2, sugarG: 3, sodiumMg: 400 };
    const merged = mergeFetchedMicrosPer100g(existing, {});
    expect(merged).toEqual(existing);
  });

  it("returns {} when neither side has any micros", () => {
    expect(mergeFetchedMicrosPer100g(undefined, undefined)).toEqual({});
    expect(mergeFetchedMicrosPer100g({}, {})).toEqual({});
  });

  it("clamps an implausible merged value (defensive vendor-data ceiling)", () => {
    const existing = { sodiumMg: 400 };
    const fetched = { sodiumMg: 999_999 };
    const merged = mergeFetchedMicrosPer100g(existing, fetched);
    expect(merged.sodiumMg).toBeUndefined();
  });

  it("a fetched-only key not present on the search hit still surfaces", () => {
    const merged = mergeFetchedMicrosPer100g(undefined, { vitaminDIu: 40 });
    expect(merged).toEqual({ vitaminDIu: 40 });
  });
});
