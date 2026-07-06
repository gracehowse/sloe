/**
 * Recipe-detail frame (Figma 332:2) — logic pins for the SHIPPED shared
 * recipe-detail helpers. Re-pinned 2026-06-09 to the canonical structure
 * (mobile `recipeDetailV3SourcePins.test.ts` is the reference for what the
 * source actually does).
 *
 * The earlier pass asserted an intermediate frame variant with a fabricated
 * ★ rating, a `recipeDifficultyFromSteps` step-count heuristic, and a
 * `fitsYourDayChipStyle` palette helper. None of those shipped: the canonical
 * meta row is the no-fakes `composeRecipeMeta` (time + items only — rating /
 * difficulty are DELIBERATELY omitted because the `recipes` table carries no
 * aggregate-rating or difficulty column, per the no-invented-metadata rule),
 * and the "Fits your day" chip is tinted inline from `verdict.tone` on both
 * platforms rather than via a shared palette helper.
 *
 *   - `composeRecipeMeta`         (frame §5: ⏱ time · 🗂 N items, real data only)
 *   - `computeFitsYourDayVerdict` (frame §323–325 copy + tone)
 *
 * Web + mobile both consume these, so a regression here breaks both.
 */
import { describe, expect, it } from "vitest";
import {
  composeRecipeMeta,
  computeCreatorDiscrepancy,
  computeFitsYourDayVerdict,
} from "../../src/lib/recipe/recipeDetailLayout";

describe("composeRecipeMeta — real data only, hide unknowns", () => {
  it("renders time + items when both are present (no fabricated rating/difficulty)", () => {
    // Rating + difficulty are intentionally NOT surfaced — the recipes table has
    // no aggregate-rating or difficulty column and we never invent recipe
    // metadata (no-fakes rule). Only real timing + ingredient count render.
    const parts = composeRecipeMeta({ prepMin: 10, cookMin: 25, ingredientCount: 8 });
    expect(parts.map((p) => p.label)).toEqual(["35 min", "8 items"]);
    expect(parts.map((p) => p.key)).toEqual(["time", "items"]);
    // Never a ★ rating or a difficulty label on this surface.
    expect(parts.find((p) => p.key === "rating")).toBeUndefined();
    expect(parts.find((p) => p.key === "difficulty")).toBeUndefined();
  });

  it("hides time when neither prep nor cook is known", () => {
    const parts = composeRecipeMeta({ prepMin: null, cookMin: null, ingredientCount: 5 });
    expect(parts.find((p) => p.key === "time")).toBeUndefined();
    expect(parts.map((p) => p.label)).toEqual(["5 items"]);
  });

  it("sums prep + cook into a single time stat", () => {
    const parts = composeRecipeMeta({ prepMin: 15, cookMin: 20, ingredientCount: 0 });
    expect(parts).toEqual([{ key: "time", label: "35 min" }]);
  });

  it("hides item count at zero (no '0 items')", () => {
    const parts = composeRecipeMeta({ prepMin: 10, cookMin: 0, ingredientCount: 0 });
    expect(parts.find((p) => p.key === "items")).toBeUndefined();
    expect(parts).toEqual([{ key: "time", label: "10 min" }]);
  });

  it("singularises one item", () => {
    const parts = composeRecipeMeta({ prepMin: null, cookMin: null, ingredientCount: 1 });
    expect(parts).toEqual([{ key: "items", label: "1 item" }]);
  });

  it("formats long times as hours+minutes", () => {
    const parts = composeRecipeMeta({ prepMin: 60, cookMin: 35, ingredientCount: 0 });
    expect(parts).toEqual([{ key: "time", label: "1h 35m" }]);
  });

  it("formats a whole-hour time without trailing minutes", () => {
    const parts = composeRecipeMeta({ prepMin: 60, cookMin: 60, ingredientCount: 0 });
    expect(parts).toEqual([{ key: "time", label: "2h" }]);
  });

  it("renders nothing when there is no real data at all", () => {
    expect(composeRecipeMeta({ prepMin: null, cookMin: null, ingredientCount: 0 })).toEqual([]);
    expect(composeRecipeMeta({ prepMin: undefined, cookMin: undefined, ingredientCount: undefined })).toEqual([]);
  });
});

describe("computeFitsYourDayVerdict — tone thresholds + frame copy", () => {
  it("≤50% of day → success tone, leads with 'Fits your day'", () => {
    const v = computeFitsYourDayVerdict({ kcal: 600, targetCals: 2000 });
    expect(v).not.toBeNull();
    expect(v!.tone).toBe("success");
    expect(v!.fits).toBe(true);
    expect(v!.label).toMatch(/^Fits your day/);
  });

  it("51–99% → warning tone (amber), honest over-half copy", () => {
    const v = computeFitsYourDayVerdict({ kcal: 1400, targetCals: 2000 });
    expect(v!.tone).toBe("warning");
    expect(v!.fits).toBe(false);
    expect(v!.label).not.toMatch(/Fits your day/);
  });

  it("≥100% → destructive tone, states the over-day cost", () => {
    const v = computeFitsYourDayVerdict({ kcal: 2200, targetCals: 2000 });
    expect(v!.tone).toBe("destructive");
    // Canonical copy (frame §325): the over-budget verdict spells out that the
    // recipe is over a full day's calories.
    expect(v!.label).toMatch(/over a full day/);
    expect(v!.a11y).toMatch(/over a full day/i);
  });

  it("returns null when nutrition or target is unknown (no zero-kcal verdict)", () => {
    expect(computeFitsYourDayVerdict({ kcal: 0, targetCals: 2000 })).toBeNull();
    expect(computeFitsYourDayVerdict({ kcal: 500, targetCals: 0 })).toBeNull();
    expect(computeFitsYourDayVerdict({ kcal: 500, targetCals: null })).toBeNull();
  });

  it("the verdict carries a 5-percent-rounded pct + an a11y long-form label", () => {
    const v = computeFitsYourDayVerdict({ kcal: 410, targetCals: 2000 })!;
    // 410/2000 = 20.5% → rounds to nearest 5 → 20.
    expect(v.pct).toBe(20);
    expect(v.a11y).toMatch(/20 percent of your daily calorie target/);
  });
});

describe("computeCreatorDiscrepancy — ENG-1416 (2026-07-05 deep audit rt-F2/fill-F2)", () => {
  it("returns null when calories is zero (was: Infinity% divide-by-zero)", () => {
    // Math.abs(creatorCalories - 0) / 0 === Infinity, which is always > 0.1 —
    // the old inline check both fired incorrectly AND rendered "Infinity%".
    expect(
      computeCreatorDiscrepancy({ creatorCalories: 500, calories: 0, isVerified: true }),
    ).toBeNull();
  });

  it("returns null when calories is negative or nullish", () => {
    expect(
      computeCreatorDiscrepancy({ creatorCalories: 500, calories: null, isVerified: true }),
    ).toBeNull();
    expect(
      computeCreatorDiscrepancy({ creatorCalories: 500, calories: -10, isVerified: true }),
    ).toBeNull();
  });

  it("returns null when there is no creator-claimed calorie figure", () => {
    expect(
      computeCreatorDiscrepancy({ creatorCalories: null, calories: 400, isVerified: true }),
    ).toBeNull();
    expect(
      computeCreatorDiscrepancy({ creatorCalories: 0, calories: 400, isVerified: true }),
    ).toBeNull();
  });

  it("returns null when the difference is within the 10% tolerance band", () => {
    // |440 - 400| / 400 = 10% exactly — at the boundary, not over it.
    expect(
      computeCreatorDiscrepancy({ creatorCalories: 440, calories: 400, isVerified: true }),
    ).toBeNull();
  });

  it("flags a >10% discrepancy with the rounded percentage", () => {
    // |500 - 400| / 400 = 25%.
    const d = computeCreatorDiscrepancy({ creatorCalories: 500, calories: 400, isVerified: true });
    expect(d).not.toBeNull();
    expect(d!.pctDifference).toBe(25);
  });

  it("claims 'Verified value' only when isVerified is true", () => {
    const verified = computeCreatorDiscrepancy({ creatorCalories: 500, calories: 400, isVerified: true });
    expect(verified!.copy).toBe("Verified value calculated from ingredient data");

    const unverified = computeCreatorDiscrepancy({ creatorCalories: 500, calories: 400, isVerified: false });
    expect(unverified!.copy).toBe("Estimated value calculated from ingredient data — not yet verified");
    expect(unverified!.copy).not.toMatch(/^Verified/);

    // Nullish/undefined isVerified must NOT default to the "Verified" claim —
    // that would silently re-introduce the over-trust bug for rows with no
    // verify status recorded at all.
    const unknown = computeCreatorDiscrepancy({ creatorCalories: 500, calories: 400, isVerified: undefined });
    expect(unknown!.copy).not.toMatch(/^Verified/);
  });

  it("works symmetrically when the creator's figure is lower than the computed total", () => {
    // |300 - 400| / 400 = 25% — creator understated, not overstated.
    const d = computeCreatorDiscrepancy({ creatorCalories: 300, calories: 400, isVerified: true });
    expect(d!.pctDifference).toBe(25);
  });
});
