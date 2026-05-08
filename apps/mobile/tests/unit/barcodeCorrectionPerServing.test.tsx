/**
 * Barcode correction — per-serving scaling + F-18 copy parity.
 *
 * Covers two adjacent fixes to the Scan Barcode modal, shipped 2026-04-19:
 *
 * F-20 (TestFlight `AIOek8w6GKW5DdY1XK9avkE`): "Correct This Product"
 * silently stored per-serving inputs as per-100g → wildly inflated
 * calories (PBfit: 375 kcal per 16 g serving was being written as
 * 375 kcal per 100 g). Fix: basis toggle + pure `scaleCorrectionToPer100g`
 * helper. These cases pin the scaling + invalid-input gating so the
 * bug cannot regress. The helper is invoked from the modal via
 * `useMemo` and drives the submit-disabled gate.
 *
 * F-18 (TestFlight `ABs9n0AyFkA8VeH7WPbwdGE`): layout polish. The
 * four copy strings the tester flagged are asserted as source-literal
 * tokens in the modal so a well-meaning rewrite can't silently drift.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  scaleCorrectionToPer100g,
  type CorrectionInput,
} from "../../lib/barcodeCorrection";

const MODAL_SRC = readFileSync(
  resolve(__dirname, "../../components/BarcodeScannerModal.tsx"),
  "utf8",
);

describe("F-20 · scaleCorrectionToPer100g — per-serving correction scaling", () => {
  it("returns identity (rounded) when basis is per-100g", () => {
    const input: CorrectionInput = {
      basis: "per100g",
      calories: 375,
      protein: 50,
      carbs: 30,
      fat: 11,
    };
    expect(scaleCorrectionToPer100g(input)).toEqual({
      calories: 375,
      protein: 50,
      carbs: 30,
      fat: 11,
    });
  });

  it("scales per-serving inputs up to per-100g (PBfit: 375 kcal / 16 g → ~2344 kcal / 100 g)", () => {
    const input: CorrectionInput = {
      basis: "perServing",
      calories: 375,
      protein: 50,
      carbs: 30,
      fat: 11,
      servingGrams: 16,
    };
    const out = scaleCorrectionToPer100g(input);
    expect(out).not.toBeNull();
    // 375 × (100 / 16) = 2343.75 → rounds to 2344.
    expect(out?.calories).toBe(2344);
    // 50 × (100 / 16) = 312.5 → stays one-decimal.
    expect(out?.protein).toBe(312.5);
    expect(out?.carbs).toBe(187.5);
    expect(out?.fat).toBe(68.8);
  });

  it("returns null when per-serving is selected but serving grams is missing or zero", () => {
    const missing: CorrectionInput = {
      basis: "perServing",
      calories: 375,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    expect(scaleCorrectionToPer100g(missing)).toBeNull();

    const zero: CorrectionInput = {
      basis: "perServing",
      calories: 375,
      protein: 0,
      carbs: 0,
      fat: 0,
      servingGrams: 0,
    };
    expect(scaleCorrectionToPer100g(zero)).toBeNull();
  });

  it("returns null when calories are zero (no partial / negative submits)", () => {
    expect(
      scaleCorrectionToPer100g({
        basis: "per100g",
        calories: 0,
        protein: 10,
        carbs: 5,
        fat: 3,
      }),
    ).toBeNull();
  });

  it("handles fractional serving sizes correctly", () => {
    const out = scaleCorrectionToPer100g({
      basis: "perServing",
      calories: 100,
      protein: 8,
      carbs: 12,
      fat: 4,
      servingGrams: 40,
    });
    // 100 × (100 / 40) = 250.
    expect(out?.calories).toBe(250);
    // 8 × 2.5 = 20.
    expect(out?.protein).toBe(20);
  });

  it("downscales large-serving per-serving inputs below the per-100g number", () => {
    // A 240 g yogurt tub labelled 150 kcal per serving → 62.5 kcal / 100 g.
    const out = scaleCorrectionToPer100g({
      basis: "perServing",
      calories: 150,
      protein: 15,
      carbs: 10,
      fat: 4,
      servingGrams: 240,
    });
    expect(out?.calories).toBe(63);
    expect(out?.protein).toBe(6.3);
  });
});

describe("F-20 · form wiring — modal references the shared helper + basis labels", () => {
  it("imports scaleCorrectionToPer100g from the pure helper module", () => {
    expect(MODAL_SRC).toMatch(/scaleCorrectionToPer100g/);
    expect(MODAL_SRC).toMatch(
      /from\s+"@\/lib\/barcodeCorrection"/,
    );
  });

  it("keeps the established 'Per 100 g' and 'Per serving' labels (Custom Food parity)", () => {
    expect(MODAL_SRC).toContain("Per 100 g");
    expect(MODAL_SRC).toContain("Per serving");
  });

  it("exposes a Serving size (g) input for the per-serving branch", () => {
    expect(MODAL_SRC).toContain("Serving size (g)");
    expect(MODAL_SRC).toMatch(/accessibilityLabel="Serving size in grams"/);
  });

  it("renders the live per-100g reference line so users can sanity-check scaling", () => {
    // "= {kcal_per_100g} kcal / 100 g" — literal ` kcal / 100 g` suffix.
    expect(MODAL_SRC).toMatch(/kcal \/ 100 g/);
  });
});

describe("F-18 · parity pins — four specific copy strings from the scan card", () => {
  it("Log button uses mid-dot instead of nested parentheses", () => {
    // F-18 / F-135 evolved this string. F-18 collapsed the nested
    // parens (`Log (1 serving (100 g))` → `Log · 1 serving`); F-135
    // stripped the trailing `(~Ng)` parenthetical via a regex so long
    // portion labels stop wrapping mid-word. The pin tracks the
    // shape: a mid-dot Log line that USES `portionSummary` (with or
    // without the F-135 regex strip) and is NOT the nested-paren form.
    expect(MODAL_SRC).toMatch(/Log · \{portionSummary\b/);
    expect(MODAL_SRC).not.toContain("Log ({portionSummary})");
  });

  it("chip labels route through displayServingLabel so the generic '1 serving (N g)' collapses to 'N g'", () => {
    expect(MODAL_SRC).toContain("displayServingLabel(o.label, o.grams)");
    expect(MODAL_SRC).toMatch(/GENERIC_1_SERVING_LABEL/);
  });

  it("helper text above the chips is the simplified 'Tap a chip or edit grams.' copy", () => {
    expect(MODAL_SRC).toContain("Tap a chip or edit grams.");
    // And the verbose technical line is gone.
    expect(MODAL_SRC).not.toContain(
      "Tap a label serving or edit grams (macros scale from per 100 g).",
    );
  });

  it("product card padding tightened (padding=Spacing.lg, gap=Spacing.xs, btnRow marginTop=0)", () => {
    // The four specific rhythm knobs the spec called out. Kept as
    // source-literal asserts so someone doesn't silently widen the card
    // back out without updating this test.
    expect(MODAL_SRC).toMatch(/productCard:[\s\S]*?padding:\s*Spacing\.lg/);
    expect(MODAL_SRC).toMatch(/productCard:[\s\S]*?gap:\s*Spacing\.xs/);
    expect(MODAL_SRC).toMatch(/btnRow:[\s\S]*?marginTop:\s*0/);
  });
});
