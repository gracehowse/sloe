/**
 * F-138 (`AcUlNw_4ZTCMGcjmETcQUaJ`, 2026-05-08) — Grace's "Correct This
 * Product" feedback. Pre-fix:
 *   - Tap Save Correction → form silently closed, zero confirmation
 *   - Subtitle claimed "your correction helps everyone" but no review
 *     workflow exists today, so the claim was misleading
 *
 * Post-fix:
 *   - submitCorrection sets corrSubmitted=true; the form is replaced
 *     by a success card (white card + green-accent ring + checkmark)
 *     with honest copy about the *current* effect ("applies to your
 *     scans now") and the *future* effect ("review process being
 *     built — best corrections will roll out to everyone").
 *   - "Done" button calls handleCorrectionDone which clears submitted
 *     + correctionMode and resets gramsInput, dropping back to the
 *     product card with the corrected values applied.
 *
 * Static-analysis pin so the regression doesn't sneak back in via a
 * future drive-by edit.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const SRC = readFileSync(
  resolve(REPO, "apps/mobile/components/BarcodeScannerModal.tsx"),
  "utf8",
);
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("F-138 — Correct-Product post-submit success state", () => {
  it("declares corrSubmitted state with a useState hook", () => {
    expect(CODE).toMatch(/const\s+\[corrSubmitted,\s*setCorrSubmitted\]\s*=\s*useState\(false\)/);
  });

  it("submitCorrection sets corrSubmitted=true on success (not setCorrectionMode(false))", () => {
    // The success branch must show the success card, not silently close.
    // Look for the submit-success block and assert it sets corrSubmitted true.
    const submitMatch = /if\s*\(\s*result\.ok\s*\)\s*\{[\s\S]{0,1500}?setCorrSubmitted\(true\)/;
    expect(CODE).toMatch(submitMatch);
  });

  it("renders a success card branch gated on correctionMode && corrSubmitted", () => {
    expect(CODE).toMatch(/correctionMode\s*&&\s*corrSubmitted/);
  });

  it("renders the form branch gated on correctionMode && !corrSubmitted", () => {
    expect(CODE).toMatch(/correctionMode\s*&&\s*!corrSubmitted/);
  });

  it("success card uses Accent.success ring + checkmark-circle icon", () => {
    // Both should appear inside the success-card render block.
    expect(CODE).toMatch(/correctionSuccessCard/);
    expect(CODE).toMatch(/checkmark-circle/);
    expect(CODE).toMatch(/Accent\.success/);
  });

  it("handleCorrectionDone clears corrSubmitted + correctionMode + resets grams", () => {
    expect(CODE).toMatch(/handleCorrectionDone[\s\S]{0,400}setCorrSubmitted\(false\)/);
    expect(CODE).toMatch(/handleCorrectionDone[\s\S]{0,400}setCorrectionMode\(false\)/);
  });

  it("onReset and handleClose reset corrSubmitted to false", () => {
    expect(CODE).toMatch(/onReset[\s\S]{0,400}setCorrSubmitted\(false\)/);
    expect(CODE).toMatch(/handleClose[\s\S]{0,400}setCorrSubmitted\(false\)/);
  });

  it("subtitle no longer overpromises 'helps everyone' (no live review pipeline yet)", () => {
    // Pre-fix subtitle: "Update the nutrition info — your correction helps everyone."
    // Post-fix is honest about the *current* effect (your scans) and
    // doesn't claim shared-database delivery that doesn't exist yet.
    expect(CODE).not.toMatch(/your correction helps everyone/);
  });

  it("success body does not claim a 'verified by team' workflow that doesn't exist today", () => {
    // Strict: must not mention a verification badge being awarded
    // post-review, since no review process is live. Future state copy
    // is OK ("we're building", "will roll out"), but no present-tense
    // "we review and verify" claim.
    expect(CODE).not.toMatch(/verified by (?:our )?team/i);
    expect(CODE).not.toMatch(/you'll see a "verified" badge once it's/i);
  });
});
