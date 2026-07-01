/**
 * GROW-61 (recipe-import audit, 2026-07-01) — the pure scoring behind the
 * Reel-import parse-rate harness (`scripts/benchmark-tiktok-import.mjs`).
 *
 * Pins the Definition-B classifier so the launch-gate number the harness prints
 * is trustworthy: matched → pass, zero-calorie shell → fail, low-match → fail,
 * request-failed → fail. Plus a drift test that the harness's structured-source
 * patterns stay in lockstep with the app's `structuredSourceGate` (they're
 * duplicated because `.mjs` can't import the TS module).
 */
import { describe, it, expect } from "vitest";
import {
  MATCH_RATE_THRESHOLD,
  classifyImportResult,
  summarise,
  isStructuredSource as harnessIsStructuredSource,
  ingredientMatchRate,
} from "../../scripts/lib/reelImportScore.mjs";
import { isStructuredSource as appIsStructuredSource } from "../../src/lib/nutrition/structuredSourceGate";

const usable = () => ({
  ingredients: ["a", "b", "c", "d"],
  calories: 480,
  ingredientMacros: [
    { source: "USDA", calories: 100 },
    { source: "OFF", calories: 90 },
    { source: "FatSecret", calories: 120 },
    { source: "USDA", calories: 80 },
  ],
});

describe("classifyImportResult — Definition-B (strict success / launch gate)", () => {
  it("matched usable recipe → Definition B passes (and A, and caption-present)", () => {
    const r = classifyImportResult({ ok: true, recipe: usable() });
    expect(r.definitionB).toBe(true);
    expect(r.definitionA).toBe(true);
    expect(r.captionPresent).toBe(true);
    expect(r.failureReason).toBeNull();
  });

  it("zero-calorie shell → B fails (zero_macro_shell) but A still passes", () => {
    const recipe = { ...usable(), calories: 0 };
    const r = classifyImportResult({ ok: true, recipe });
    expect(r.definitionA).toBe(true);
    expect(r.definitionB).toBe(false);
    expect(r.failureReason).toBe("zero_macro_shell");
  });

  it("low match rate (below threshold) → B fails, reason names the rate", () => {
    const recipe = {
      ingredients: ["a", "b", "c", "d"],
      calories: 400,
      ingredientMacros: [
        { source: "USDA", calories: 100 },
        { source: "Unverified", calories: 0 },
        { source: "Estimated", calories: 50 },
        { source: "Unverified", calories: 0 },
      ], // 1/4 = 0.25 < 0.7
    };
    const r = classifyImportResult({ ok: true, recipe });
    expect(r.matchRate).toBeCloseTo(0.25, 5);
    expect(r.definitionA).toBe(true);
    expect(r.definitionB).toBe(false);
    expect(r.failureReason).toContain("low_match_rate");
  });

  it("no ingredients → A and B both fail (no_ingredients)", () => {
    const r = classifyImportResult({ ok: true, recipe: { ingredients: [], calories: 0 } });
    expect(r.definitionA).toBe(false);
    expect(r.definitionB).toBe(false);
    expect(r.captionPresent).toBe(false);
    expect(r.failureReason).toBe("no_ingredients");
  });

  it("request failed (ok:false) → everything fails (request_failed)", () => {
    const r = classifyImportResult({ ok: false, recipe: null });
    expect(r.definitionA).toBe(false);
    expect(r.definitionB).toBe(false);
    expect(r.captionPresent).toBe(false);
    expect(r.failureReason).toBe("request_failed");
  });

  it("honours a custom threshold", () => {
    // 2/4 = 0.5 matched; passes at 0.5 threshold, fails at default 0.7.
    const recipe = {
      ingredients: ["a", "b", "c", "d"],
      calories: 300,
      ingredientMacros: [
        { source: "USDA", calories: 100 },
        { source: "OFF", calories: 90 },
        { source: "Unverified", calories: 0 },
        { source: "Estimated", calories: 40 },
      ],
    };
    expect(classifyImportResult({ ok: true, recipe, threshold: 0.5 }).definitionB).toBe(true);
    expect(classifyImportResult({ ok: true, recipe, threshold: 0.7 }).definitionB).toBe(false);
  });
});

describe("summarise — the reported three metrics", () => {
  it("counts A / B / caption-present with percentages", () => {
    const rows = [
      classifyImportResult({ ok: true, recipe: usable() }), // B (and A, caption)
      classifyImportResult({ ok: true, recipe: { ...usable(), calories: 0 } }), // A + caption, not B
      classifyImportResult({ ok: false, recipe: null }), // none
      classifyImportResult({ ok: true, recipe: { ingredients: [], calories: 0 } }), // none
    ];
    const s = summarise(rows);
    expect(s.total).toBe(4);
    expect(s.definitionA.count).toBe(2);
    expect(s.definitionB.count).toBe(1);
    expect(s.captionPresent.count).toBe(2);
    expect(s.definitionB.pct).toBe(25);
    expect(s.definitionA.pct).toBe(50);
  });
});

describe("ingredientMatchRate parity + structured-source drift guard", () => {
  it("harness match-rate mirrors the app derivation on a mixed recipe", () => {
    // 3 of 4 rows are structured with real macros → 0.75.
    expect(ingredientMatchRate(usable())).toBe(1);
    const mixed = {
      ingredientMacros: [
        { source: "USDA", calories: 100 },
        { source: "OFF", calories: 90 },
        { source: "FatSecret", calories: 120 },
        { source: "Unverified", calories: 0 },
      ],
    };
    expect(ingredientMatchRate(mixed)).toBeCloseTo(0.75, 5);
  });

  it("harness isStructuredSource agrees with the app gate (no drift)", () => {
    const cases = [
      "USDA",
      "usda",
      "OFF",
      "Open Food Facts",
      "openfoodfacts",
      "FatSecret Premier",
      "Edamam",
      "Unverified",
      "Estimated",
      "Manual",
      "",
      null,
      undefined,
    ];
    for (const c of cases) {
      expect(harnessIsStructuredSource(c)).toBe(appIsStructuredSource(c ?? undefined));
    }
  });

  it("exposes a documented default threshold", () => {
    expect(MATCH_RATE_THRESHOLD).toBe(0.7);
  });
});
