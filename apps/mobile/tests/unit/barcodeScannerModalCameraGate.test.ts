/**
 * F-134 + F-135 + F-136 (build-44 testing session, 2026-05-08) — pin
 * the BarcodeScannerModal fixes that close 5 of 11 build-44 screenshots:
 *
 *   F-134 — camera + scanFrame collapse on result state (no more "blob"
 *           floating above the productCard).
 *   F-135 — Log button text strips the parenthetical "(~Ng)" so long
 *           portion labels don't wrap mid-word; chip labels with
 *           absurd decimal precision (11.33 rice papers) collapse to
 *           the integer when the fractional residual is < 0.1 / > 0.9.
 *   F-136 — "We don't have this product yet" empty state uses a neutral
 *           info icon (not red destructive) and demotes the 3-CTA
 *           stack to 1 primary + 2 text links.
 *
 * Static analysis pin so a future agent can't drop the gates silently.
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

describe("F-134 — BarcodeScannerModal camera gates on result state", () => {
  it("BarcodeCameraView render is gated on !scanned && !manualMode && !correctionMode", () => {
    expect(CODE).toMatch(/!scanned\s*&&\s*!manualMode\s*&&\s*!correctionMode/);
  });

  it("scanFrame render lives inside the gated camera block (never renders standalone)", () => {
    const scanFrameUses = (CODE.match(/styles\.scanFrame/g) ?? []).length;
    expect(scanFrameUses).toBe(1);
  });

  it("resultArea has flex: 1 so it claims the freed camera space", () => {
    expect(CODE).toMatch(/resultArea:\s*\{[^}]*flex:\s*1/);
  });
});

describe("F-135 — Log button text strips parenthetical + tidies decimal counts", () => {
  it("Log button strips trailing '(~Ng)' parenthetical via String.replace", () => {
    expect(CODE).toMatch(/portionSummary\.replace\(\/\\s\*\\\(~\?\[\\d\.\]\+\\s\*g\\\)\\s\*\$\//);
  });

  it("Log button text uses numberOfLines={1} + ellipsizeMode='tail' as safety net", () => {
    // Look for the useBtnText with numberOfLines / ellipsizeMode props.
    expect(CODE).toMatch(/styles\.useBtnText[\s\S]{0,200}numberOfLines=\{1\}[\s\S]{0,200}ellipsizeMode="tail"/);
  });

  it("tidyDecimalCount helper exists in the module", () => {
    expect(CODE).toMatch(/tidyDecimalCount/);
  });
});

describe("F-136 — Not-found empty state uses neutral icon + demoted CTAs", () => {
  it("Not-found branch uses the neutral Search icon instead of the destructive CircleAlert", () => {
    // ENG-120 (Lucide migration): search-outline → <Search>, alert-circle →
    // <CircleAlert>. The neutral Search icon appears in the Product-not-found
    // ternary; CircleAlert is the else branch (genuine errors).
    expect(CODE).toMatch(/error\s*===\s*"Product not found in database\.".*Search/s);
  });

  it("CircleAlert remains for genuine errors (different branch)", () => {
    expect(CODE).toMatch(/CircleAlert/);
  });
});
