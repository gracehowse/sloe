/**
 * Sloe image system + recipe-detail frame (2026-06-08) — logic pins for
 * the shared recipe-detail helpers introduced/changed this pass:
 *
 *   - `composeRecipeMetaParts` (frame §5: ★ rating · time · difficulty · N items)
 *   - `recipeDifficultyFromSteps` (transparent step-count heuristic)
 *   - `fitsYourDayChipStyle` (frame §315 sage/amber chip palette)
 *   - `computeFitsYourDayVerdict` copy + tone (frame §323–325)
 *
 * These are the testable behaviours behind the visible display fixes;
 * web + mobile both consume them so a regression here breaks both.
 */
import { describe, expect, it } from "vitest";
import {
  composeRecipeMetaParts,
  computeFitsYourDayVerdict,
  fitsYourDayChipStyle,
  recipeDifficultyFromSteps,
} from "../../src/lib/recipe/recipeDetailLayout";

describe("recipeDifficultyFromSteps — transparent heuristic", () => {
  it.each([
    [1, "Easy"],
    [4, "Easy"],
    [5, "Medium"],
    [8, "Medium"],
    [9, "Involved"],
    [20, "Involved"],
  ])("%i steps → %s", (steps, expected) => {
    expect(recipeDifficultyFromSteps(steps)).toBe(expected);
  });

  it("returns null for unknown / zero step counts (hidden, not guessed)", () => {
    expect(recipeDifficultyFromSteps(0)).toBeNull();
    expect(recipeDifficultyFromSteps(null)).toBeNull();
    expect(recipeDifficultyFromSteps(undefined)).toBeNull();
    expect(recipeDifficultyFromSteps(Number.NaN)).toBeNull();
  });
});

describe("composeRecipeMetaParts — real data only, hide unknowns", () => {
  it("renders all four parts when all data is present", () => {
    const parts = composeRecipeMetaParts({
      rating: 4.6,
      totalMinutes: 35,
      stepCount: 6,
      itemCount: 8,
    });
    expect(parts.map((p) => p.label)).toEqual(["★ 4.6", "35 min", "Medium", "8 items"]);
  });

  it("hides the rating when unknown (no fabricated ★)", () => {
    const parts = composeRecipeMetaParts({
      rating: null,
      totalMinutes: 20,
      stepCount: 3,
      itemCount: 5,
    });
    expect(parts.find((p) => p.key === "rating")).toBeUndefined();
    expect(parts.map((p) => p.label)).toEqual(["20 min", "Easy", "5 items"]);
  });

  it("hides time when neither prep nor cook is known", () => {
    const parts = composeRecipeMetaParts({ totalMinutes: 0, stepCount: 2, itemCount: 4 });
    expect(parts.find((p) => p.key === "time")).toBeUndefined();
  });

  it("hides item count at zero (no '0 items')", () => {
    const parts = composeRecipeMetaParts({ totalMinutes: 10, stepCount: 1, itemCount: 0 });
    expect(parts.find((p) => p.key === "items")).toBeUndefined();
  });

  it("singularises one item", () => {
    const parts = composeRecipeMetaParts({ itemCount: 1 });
    expect(parts).toEqual([{ key: "items", label: "1 item" }]);
  });

  it("formats long times as hours+minutes", () => {
    const parts = composeRecipeMetaParts({ totalMinutes: 95 });
    expect(parts).toEqual([{ key: "time", label: "1h 35m" }]);
  });

  it("renders nothing when there is no real data at all", () => {
    expect(composeRecipeMetaParts({})).toEqual([]);
    expect(composeRecipeMetaParts({ rating: null, totalMinutes: 0, stepCount: 0, itemCount: 0 })).toEqual([]);
  });

  it("trims a whole-number rating (4.0 → '★ 4')", () => {
    const parts = composeRecipeMetaParts({ rating: 4 });
    expect(parts).toEqual([{ key: "rating", label: "★ 4" }]);
  });

  it("ignores an out-of-range rating", () => {
    expect(composeRecipeMetaParts({ rating: 0 })).toEqual([]);
    expect(composeRecipeMetaParts({ rating: 6 })).toEqual([]);
    expect(composeRecipeMetaParts({ rating: -1 })).toEqual([]);
  });
});

describe("fitsYourDayChipStyle — frame §315 sage/amber palette", () => {
  it("success is sage text on a 10% sage fill (the permission moment)", () => {
    expect(fitsYourDayChipStyle("success")).toEqual({
      fg: "#5E7C5A",
      bg: "rgba(94, 124, 90, 0.1)",
    });
  });

  it("warning is amber text on a 10% amber fill", () => {
    expect(fitsYourDayChipStyle("warning")).toEqual({
      fg: "#C9892C",
      bg: "rgba(201, 137, 44, 0.1)",
    });
  });

  it("'over a day' stays amber (deeper 20% fill) — never destructive red", () => {
    const style = fitsYourDayChipStyle("destructive");
    expect(style.fg).toBe("#C9892C");
    expect(style.bg).toBe("rgba(201, 137, 44, 0.2)");
    // Belt-and-braces: the over-budget chip is NOT red on this surface
    // (only the calorie ring uses red for over-budget).
    expect(style.fg).not.toMatch(/c0533f|F16264|f87171|ef4444/i);
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
    expect(v!.label).toMatch(/Over your day/);
    expect(v!.a11y).toMatch(/over a full day/i);
  });

  it("returns null when nutrition or target is unknown (no zero-kcal verdict)", () => {
    expect(computeFitsYourDayVerdict({ kcal: 0, targetCals: 2000 })).toBeNull();
    expect(computeFitsYourDayVerdict({ kcal: 500, targetCals: 0 })).toBeNull();
    expect(computeFitsYourDayVerdict({ kcal: 500, targetCals: null })).toBeNull();
  });

  it("the chip style is consistent with the verdict tone for every bucket", () => {
    const success = computeFitsYourDayVerdict({ kcal: 400, targetCals: 2000 })!;
    const warning = computeFitsYourDayVerdict({ kcal: 1200, targetCals: 2000 })!;
    const over = computeFitsYourDayVerdict({ kcal: 2500, targetCals: 2000 })!;
    expect(fitsYourDayChipStyle(success.tone).fg).toBe("#5E7C5A");
    expect(fitsYourDayChipStyle(warning.tone).fg).toBe("#C9892C");
    expect(fitsYourDayChipStyle(over.tone).fg).toBe("#C9892C");
  });
});
