/**
 * 2026-05-08 build-45 follow-up — pin the scan-label-to-database
 * wiring so a future agent can't silently regress to the photo-log
 * fallback (which doesn't write to user_foods).
 *
 * Grace's repro: scan a barcode that's not in the database → tap
 * "Snap the label instead" → AI parses macros but they don't actually
 * save → next scan of the same barcode fails identically.
 *
 * Fix:
 *   - New /api/nutrition/scan-label route extracts per-100g + name
 *   - BarcodeScannerModal calls handleSnapLabel which posts the photo
 *     to that endpoint and pre-fills the existing correctionMode form
 *   - User reviews and saves → submitFoodCorrection (Phase 2 plausibility
 *     + writes to user_foods) → next scan hits the canonical/own-pending
 *     read path instead of falling through to OFF and failing
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("build-45 fix — scan-label-to-database wiring", () => {
  const SRC = read("apps/mobile/components/BarcodeScannerModal.tsx");

  it("declares handleSnapLabel callback", () => {
    expect(SRC).toMatch(/const\s+handleSnapLabel\s*=\s*useCallback/);
  });

  it("handleSnapLabel POSTs to /api/nutrition/scan-label", () => {
    expect(SRC).toMatch(/\/api\/nutrition\/scan-label/);
  });

  it("handleSnapLabel uses ImagePicker.launchCameraAsync (no PhotoLogSheet hop)", () => {
    expect(SRC).toMatch(/ImagePicker\.launchCameraAsync/);
  });

  it("on success, pre-fills correction-mode form fields with extracted values", () => {
    // The success branch must populate corrName, corrCalories, corrProtein,
    // corrCarbs, corrFat, then enter correctionMode. Match the populate-then-
    // setCorrectionMode pattern.
    const idx = SRC.indexOf("handleSnapLabel");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 6000);
    expect(slice).toMatch(/setCorrName\(/);
    expect(slice).toMatch(/setCorrCalories\(/);
    expect(slice).toMatch(/setCorrProtein\(/);
    expect(slice).toMatch(/setCorrCarbs\(/);
    expect(slice).toMatch(/setCorrFat\(/);
    expect(slice).toMatch(/setCorrectionMode\(true\)/);
  });

  it("Snap-the-label button calls handleSnapLabel (NOT onPhotoFallback)", () => {
    // The button's onPress should be handleSnapLabel directly, not
    // routed through the legacy onPhotoFallback path.
    expect(SRC).toMatch(/onPress=\{handleSnapLabel\}/);
  });

  it("loading + error states surface inline (no silent failure)", () => {
    expect(SRC).toMatch(/scanLabelLoading/);
    expect(SRC).toMatch(/scanLabelError/);
    expect(SRC).toMatch(/Reading label\.\.\./);
  });
});

describe("build-45 fix — scan-label endpoint exists + uses Claude vision helper", () => {
  const ROUTE = read("app/api/nutrition/scan-label/route.ts");

  it("imports callAiVision from the shared aiProvider helper (no inline OpenAI/Anthropic fetch)", () => {
    expect(ROUTE).toMatch(
      /import\s*\{\s*callAiVision\s*\}\s*from\s*["'][^"']*aiProvider["']/,
    );
  });

  it("does not contain a direct OpenAI or Anthropic fetch (helper-only)", () => {
    const stripped = ROUTE.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/fetch\s*\(\s*["']https:\/\/api\.openai\.com/);
    expect(stripped).not.toMatch(/fetch\s*\(\s*["']https:\/\/api\.anthropic\.com/);
  });

  it("exports the route POST handler with maxDuration set", () => {
    expect(ROUTE).toMatch(/export\s+const\s+maxDuration\s*=\s*\d+/);
    expect(ROUTE).toMatch(/export\s+async\s+function\s+POST/);
  });
});
