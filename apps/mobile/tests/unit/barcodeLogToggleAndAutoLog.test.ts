/**
 * 2026-05-08 build-47 follow-up — Grace's TF feedback
 * `AEzXpj7cEtWzcmRM391H1pM`:
 *
 *   "When I added this it auto did serving and by 100g which is great!
 *   But I should be able to have that option when logging too. Also when
 *   I save a new item I should be able to auto log it not have to scan
 *   it again."
 *
 * Original spec called for a per-100g / per-serving toggle on the LOG
 * card. That toggle was REMOVED 2026-05-13 in favour of the shared
 * <PortionPicker> with a single { amount, unit } model — see
 * docs/decisions/2026-05-13-portion-picker-and-macro-display.md.
 *
 * This file now pins the auto-log-after-correction behaviour against
 * the new picker state (`setPickerState` / `pickerOptions.initial`),
 * not the legacy `setGramsInput` / `setLogBasis` calls.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const SRC = readFileSync(
  resolve(REPO, "apps/mobile/components/BarcodeScannerModal.tsx"),
  "utf8",
);

describe("2026-05-13 portion-picker rebuild — log card pins", () => {
  it("legacy logBasis toggle is fully removed (replaced by <PortionPicker>)", () => {
    // Mentions inside `//` historical comments are fine — we're guarding
    // against the state hook + setter actually being declared again.
    expect(SRC).not.toMatch(/const\s+\[logBasis,\s*setLogBasis\]/);
    expect(SRC).not.toMatch(/setLogBasis\s*\(/);
    expect(SRC).not.toMatch(/useState<["']per100g["']/);
  });

  it("legacy gramsInput state is fully removed", () => {
    expect(SRC).not.toMatch(/\bsetGramsInput\b/);
    expect(SRC).not.toMatch(/\[gramsInput,\s*setGramsInput\]/);
  });

  it("declares the new { amount, unit } picker state", () => {
    expect(SRC).toMatch(/const\s+\[pickerState,\s*setPickerState\]\s*=\s*useState<PortionState\s*\|\s*null>/);
  });

  it("derives pickerOptions from product via buildPickerOptions", () => {
    expect(SRC).toMatch(/buildPickerOptions\s*\(/);
  });

  it("mounts <PortionPicker> bound to pickerState / setPickerState", () => {
    expect(SRC).toMatch(/<PortionPicker\b/);
    expect(SRC).toMatch(/value=\{pickerState\}/);
    expect(SRC).toMatch(/onChange=\{setPickerState\}/);
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

  it("pre-fills the picker to its default state when serving size is known (lands on '1 serving')", () => {
    const idx = SRC.indexOf("handleCorrectionLogNow");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 2000);
    // The callback re-initialises the picker by calling
    // setPickerState(pickerOptions.initial). buildPickerOptions already
    // resolves "1 serving" as the default when servingSizeG > 0 (see
    // src/lib/nutrition/portionPicker.ts).
    expect(slice).toMatch(/setPickerState\(pickerOptions\.initial\)/);
  });

  it("preserves Done escape hatch (renamed 'Just done') as secondary action", () => {
    // The original Done button handler must still be reachable so
    // users can dismiss without auto-logging.
    expect(SRC).toMatch(/handleCorrectionDone/);
    expect(SRC).toMatch(/Just done/);
  });
});
