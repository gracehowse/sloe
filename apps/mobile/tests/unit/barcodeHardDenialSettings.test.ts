/**
 * ENG-1518 (part 1, 2026-07-11 audit) — hard-denied camera permission no
 * longer dead-ends on the barcode scanner.
 *
 * Both `(tabs)/barcode.tsx` and `BarcodeScannerModal.tsx` gated their
 * permission-denied state behind a "Grant Permission" button that called
 * `requestPermission()` unconditionally. Once a user has denied the OS
 * prompt once (`canAskAgain === false`), iOS refuses to show it again —
 * the button silently no-oped, reading as broken with no way forward.
 * Fix: route to `Linking.openSettings()` when `canAskAgain` is false, and
 * swap the label to "Open Settings" so it matches the action taken.
 *
 * Static source-scan, matching the repo idiom for these two files (real
 * camera permission state isn't exercisable under vitest/jsdom) — see
 * `barcodeScannerModalCameraGate.test.ts`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const BARCODE_SCREEN = readFileSync(
  resolve(REPO, "apps/mobile/app/(tabs)/barcode.tsx"),
  "utf8",
);
const SCANNER_MODAL = readFileSync(
  resolve(REPO, "apps/mobile/components/BarcodeScannerModal.tsx"),
  "utf8",
);

describe("(tabs)/barcode.tsx — hard-denied permission routes to Settings", () => {
  it("imports Linking from react-native", () => {
    expect(BARCODE_SCREEN).toMatch(/Linking/);
  });

  it("checks permission.canAskAgain before re-requesting", () => {
    expect(BARCODE_SCREEN).toMatch(/permission\.canAskAgain\s*===\s*false/);
  });

  it("calls Linking.openSettings() on hard denial", () => {
    expect(BARCODE_SCREEN).toMatch(/Linking\.openSettings\(\)/);
  });

  it("swaps the button label to Open Settings on hard denial", () => {
    expect(BARCODE_SCREEN).toMatch(/"Open Settings"/);
  });
});

describe("BarcodeScannerModal.tsx — hard-denied permission routes to Settings", () => {
  it("imports Linking from react-native", () => {
    expect(SCANNER_MODAL).toMatch(/Linking/);
  });

  it("checks permission?.canAskAgain before re-requesting", () => {
    expect(SCANNER_MODAL).toMatch(/permission\?\.canAskAgain\s*===\s*false/);
  });

  it("calls Linking.openSettings() on hard denial", () => {
    expect(SCANNER_MODAL).toMatch(/Linking\.openSettings\(\)/);
  });

  it("swaps the button label to Open Settings on hard denial", () => {
    expect(SCANNER_MODAL).toMatch(/"Open Settings"/);
  });
});
