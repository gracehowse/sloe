/**
 * 2026-04-30 ui-product-designer recipe-detail audit — pure-function
 * tests for the layout helpers that drive the redesigned hero stack.
 * The mobile and web detail screens both consume these helpers via
 * `apps/mobile/lib/recipe/recipeDetailLayout.ts` (re-export) and
 * `src/lib/recipe/recipeDetailLayout.ts` (source of truth).
 *
 * 2026-05-01 v3 redesign — extended:
 *   - composeSubtitleParts now accepts a `kcal` arg and emits a
 *     `kcal` part (key === "kcal") in the canonical
 *     [slot, serves, kcal, by] order.
 *   - computeFitsYourDayVerdict added so the inline verdict line
 *     below the macro tiles renders the same on mobile + web.
 *
 * If these tests fail the redesign has regressed:
 *   - hidden time-stats row reappears on a recipe with no timings
 *   - subtitle composition orders / gates change
 *   - kcal token disappears from the subtitle (= bringing back the
 *     bordered "kcal per portion" hero card it replaced)
 *   - fits-your-day verdict tone / copy / pct rounding drifts
 */
import { describe, expect, it } from "vitest";

import {
  composeSubtitleParts,
  computeFitsYourDayVerdict,
  shouldRenderTimeStats,
} from "../../lib/recipe/recipeDetailLayout";

describe("shouldRenderTimeStats", () => {
  it("returns false when both prep and cook are null", () => {
    expect(shouldRenderTimeStats(null, null)).toBe(false);
    expect(shouldRenderTimeStats(undefined, undefined)).toBe(false);
    // Zero is treated the same as missing — a 0 min cook is noise.
    expect(shouldRenderTimeStats(0, 0)).toBe(false);
  });

  it("returns true when prep is known and cook is missing", () => {
    expect(shouldRenderTimeStats(10, null)).toBe(true);
    expect(shouldRenderTimeStats(10, undefined)).toBe(true);
    expect(shouldRenderTimeStats(10, 0)).toBe(true);
  });

  it("returns true when cook is known and prep is missing", () => {
    expect(shouldRenderTimeStats(null, 25)).toBe(true);
    expect(shouldRenderTimeStats(undefined, 25)).toBe(true);
    expect(shouldRenderTimeStats(0, 25)).toBe(true);
  });
});

describe("composeSubtitleParts (v3: kcal inline)", () => {
  it("composes [slot, serves, kcal, by] in v3 canonical order", () => {
    const parts = composeSubtitleParts({
      authorLabel: "emthenutritionist",
      slots: ["Lunch"],
      servings: 3,
      kcal: 329,
    });
    expect(parts.map((p) => p.key)).toEqual(["slot", "serves", "kcal", "by"]);
    // Slot label is lowercased and joined with `, ` so we can render
    // a single `· lunch ·` token in the subtitle row.
    expect(parts[0].label).toBe("lunch");
    expect(parts[1].label).toBe("serves 3");
    expect(parts[2].label).toBe("329 kcal");
    expect(parts[3].label).toBe("by emthenutritionist");
  });

  it("rounds kcal to integer (no `329.4 kcal`)", () => {
    const parts = composeSubtitleParts({
      authorLabel: null,
      slots: null,
      servings: 1,
      kcal: 329.4,
    });
    expect(parts.find((p) => p.key === "kcal")?.label).toBe("329 kcal");
  });

  it("drops the kcal part when nutrition is unknown (kcal=null)", () => {
    // P1-16: never render a confident "0 kcal" subtitle for an
    // un-imported recipe. The kcal token must disappear so the
    // dimmed `recipe-nutrition-pending` placeholder takes over.
    const parts = composeSubtitleParts({
      authorLabel: "Grace",
      slots: ["Lunch"],
      servings: 4,
      kcal: null,
    });
    expect(parts.map((p) => p.key)).toEqual(["slot", "serves", "by"]);
    expect(parts.some((p) => p.key === "kcal")).toBe(false);
  });

  it("drops the kcal part when kcal is 0 (no `0 kcal` rendered)", () => {
    const parts = composeSubtitleParts({
      authorLabel: null,
      slots: null,
      servings: 4,
      kcal: 0,
    });
    expect(parts.some((p) => p.key === "kcal")).toBe(false);
  });

  it("drops the kcal part when kcal arg is omitted entirely", () => {
    const parts = composeSubtitleParts({
      authorLabel: "Grace",
      slots: ["Dinner"],
      servings: 2,
    });
    expect(parts.some((p) => p.key === "kcal")).toBe(false);
    expect(parts.map((p) => p.key)).toEqual(["slot", "serves", "by"]);
  });

  it("returns [serves] only when slot/kcal/author are all absent", () => {
    const parts = composeSubtitleParts({
      authorLabel: null,
      slots: null,
      servings: 4,
    });
    expect(parts.map((p) => p.key)).toEqual(["serves"]);
    expect(parts[0].label).toBe("serves 4");
  });

  it("drops the slot part when slots is an empty array (no orphan separator)", () => {
    const parts = composeSubtitleParts({
      authorLabel: "Grace",
      slots: [],
      servings: 2,
    });
    expect(parts.map((p) => p.key)).toEqual(["serves", "by"]);
  });

  it("joins multiple slots and lowercases them", () => {
    const parts = composeSubtitleParts({
      authorLabel: null,
      slots: ["Lunch", "Dinner"],
      servings: 2,
    });
    expect(parts[0].label).toBe("lunch, dinner");
  });

  it("drops servings when zero (no `serves 0` rendered)", () => {
    const parts = composeSubtitleParts({
      authorLabel: "Grace",
      slots: null,
      servings: 0,
    });
    expect(parts.map((p) => p.key)).toEqual(["by"]);
  });
});

describe("computeFitsYourDayVerdict", () => {
  it("returns null when nutrition is unknown", () => {
    expect(computeFitsYourDayVerdict({ kcal: 0, targetCals: 2000 })).toBeNull();
    expect(computeFitsYourDayVerdict({ kcal: null, targetCals: 2000 })).toBeNull();
    expect(computeFitsYourDayVerdict({ kcal: undefined, targetCals: 2000 })).toBeNull();
  });

  it("returns null when target is unset / zero", () => {
    expect(computeFitsYourDayVerdict({ kcal: 500, targetCals: null })).toBeNull();
    expect(computeFitsYourDayVerdict({ kcal: 500, targetCals: 0 })).toBeNull();
    expect(computeFitsYourDayVerdict({ kcal: 500, targetCals: undefined })).toBeNull();
  });

  it("returns success tone for ≤50% of target ('Fits your day')", () => {
    const v = computeFitsYourDayVerdict({ kcal: 600, targetCals: 2000 });
    expect(v).not.toBeNull();
    expect(v!.tone).toBe("success");
    expect(v!.fits).toBe(true);
    expect(v!.pct).toBe(30);
    expect(v!.label).toBe("Fits your day · ≈ 30%");
  });

  it("returns warning tone for 51–99% of target", () => {
    const v = computeFitsYourDayVerdict({ kcal: 1400, targetCals: 2000 });
    expect(v).not.toBeNull();
    expect(v!.tone).toBe("warning");
    expect(v!.fits).toBe(false);
    expect(v!.pct).toBe(70);
    expect(v!.label).toBe("≈ 70% of your day");
  });

  it("returns destructive tone for ≥100% with `over a full day` suffix", () => {
    const v = computeFitsYourDayVerdict({ kcal: 2400, targetCals: 2000 });
    expect(v).not.toBeNull();
    expect(v!.tone).toBe("destructive");
    expect(v!.fits).toBe(false);
    expect(v!.pct).toBe(120);
    expect(v!.label).toBe("≈ 120% of your day · over a full day");
  });

  it("rounds pct to nearest 5", () => {
    // 522 / 2000 = 26.1% → rounds to 25%
    const v = computeFitsYourDayVerdict({ kcal: 522, targetCals: 2000 });
    expect(v!.pct).toBe(25);
  });

  it("never returns 0% (small recipes still scan as 1%, not vanishing)", () => {
    const v = computeFitsYourDayVerdict({ kcal: 5, targetCals: 2000 });
    expect(v!.pct).toBeGreaterThanOrEqual(1);
  });
});
