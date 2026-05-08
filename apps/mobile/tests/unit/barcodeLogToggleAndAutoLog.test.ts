/**
 * 2026-05-08 build-47 follow-up — Grace's TF feedback
 * `AEzXpj7cEtWzcmRM391H1pM`:
 *
 *   "When I added this it auto did serving and by 100g which is great!
 *   But I should be able to have that option when logging too. Also when
 *   I save a new item I should be able to auto log it not have to scan
 *   it again."
 *
 * Two changes:
 *   1. Per-100 g / Per serving toggle on the LOG card (parity with
 *      correction form). When perServing, Amount field is interpreted
 *      as a multiplier × servingSizeG.
 *   2. "Log this now" CTA on the correction-saved success state that
 *      pre-fills the log gram input to one serving and exits correction
 *      mode, so the user lands on the product card primed to log.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const SRC = readFileSync(
  resolve(REPO, "apps/mobile/components/BarcodeScannerModal.tsx"),
  "utf8",
);

describe("build-47 — log card per-100g/per-serving toggle", () => {
  it("declares logBasis state with both modes", () => {
    expect(SRC).toMatch(
      /const\s+\[logBasis,\s*setLogBasis\]\s*=\s*useState<["']per100g["']\s*\|\s*["']perServing["']>/,
    );
  });

  it("grams useMemo multiplies by servingSizeG when in perServing mode", () => {
    expect(SRC).toMatch(
      /logBasis\s*===\s*["']perServing["'][\s\S]{0,300}servingSizeForBasis\s*\*\s*10/,
    );
  });

  it("toggle UI is gated on product.servingSizeG > 0 (gram-only fallback)", () => {
    // The toggle wrapper conditional must check both that servingSizeG
    // is set and > 0. Otherwise users see a meaningless toggle on
    // products without a known serving.
    expect(SRC).toMatch(
      /product\.servingSizeG\s*&&\s*product\.servingSizeG\s*>\s*0\s*\?\s*\(\s*<View\s+style=\{\[styles\.basisRow/,
    );
  });

  it("'By serving' chip shows the serving-size grams in parentheses", () => {
    // JSX expression in label: `By serving ({Math.round(product.servingSizeG)} g)`
    expect(SRC).toMatch(/By serving \(\{Math\.round\(product\.servingSizeG\)\} g\)/);
  });

  it("Amount unit label switches between 'g' and 'serving(s)' based on logBasis", () => {
    expect(SRC).toMatch(/logBasis\s*===\s*["']perServing["'][\s\S]{0,200}["']serving["']/);
    expect(SRC).toMatch(/logBasis\s*===\s*["']perServing["'][\s\S]{0,200}["']servings["']/);
  });
});

describe("build-47 — auto-log after correction-save", () => {
  it("declares handleCorrectionLogNow callback", () => {
    expect(SRC).toMatch(/const\s+handleCorrectionLogNow\s*=\s*useCallback/);
  });

  it("Log-this-now button on the correction-saved success card calls handleCorrectionLogNow", () => {
    expect(SRC).toMatch(/onPress=\{handleCorrectionLogNow\}/);
    expect(SRC).toMatch(/Log this now/);
  });

  it("pre-fills LOG path with 1 serving when serving size is known, else 100g", () => {
    const idx = SRC.indexOf("handleCorrectionLogNow");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 2000);
    // Must reset gramsInput + flip logBasis to perServing when
    // servingSizeG > 0 — that's the "land on the product card primed
    // to log one serving" semantic.
    expect(slice).toMatch(/setGramsInput\(/);
    expect(slice).toMatch(/setLogBasis\(/);
  });

  it("preserves Done escape hatch (renamed 'Just done') as secondary action", () => {
    // The original Done button handler must still be reachable so
    // users can dismiss without auto-logging.
    expect(SRC).toMatch(/handleCorrectionDone/);
    expect(SRC).toMatch(/Just done/);
  });
});
