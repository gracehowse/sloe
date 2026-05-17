/**
 * Mobile nutrition-sources screen parity (sync-enforcer BLOCK finding,
 * 2026-04-19).
 *
 * Prior to the fix, `apps/mobile/app/nutrition-sources.tsx` hardcoded
 * three sources (USDA, Open Food Facts, FatSecret) and was missing
 * Edamam entirely — web was advertising four sources in
 * `NUTRITION_SOURCES` (the landing SSOT) while mobile silently
 * under-claimed. The fix imports `NUTRITION_SOURCES` from the SSOT so
 * the list auto-propagates.
 *
 * This test pins:
 *   1. The mobile screen imports `NUTRITION_SOURCES` from the shared
 *      leaf file `src/lib/landing/nutritionSources` (NOT a hardcoded
 *      `SOURCES` array).
 *   2. Every source in `NUTRITION_SOURCES` has a description + URL in
 *      the mobile screen's local `SOURCE_DETAILS` map, so the user
 *      sees a fully-populated card for each.
 *
 * If this test fails because someone added a source to the SSOT
 * without adding its description on mobile, add the description —
 * don't delete the assertion.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { NUTRITION_SOURCES } from "@suppr/shared/landing/nutritionSources";

const MOBILE_PATH = resolve(__dirname, "../../app/nutrition-sources.tsx");

describe("mobile nutrition-sources screen parity", () => {
  const src = readFileSync(MOBILE_PATH, "utf8");

  it("imports NUTRITION_SOURCES from the shared SSOT leaf", () => {
    expect(src).toMatch(
      /import\s+\{\s*NUTRITION_SOURCES\s*\}\s+from\s+["'][^"']*landing\/nutritionSources["']/,
    );
  });

  it("does not hardcode a local SOURCES array", () => {
    // The pre-fix shape was `const SOURCES = [ { name: ... } ]`.
    expect(src).not.toMatch(/\bconst\s+SOURCES\s*=\s*\[/);
  });

  it("SOURCE_DETAILS covers every source in NUTRITION_SOURCES", () => {
    for (const name of NUTRITION_SOURCES) {
      // Each source's canonical name must appear inside the
      // `SOURCE_DETAILS` map definition as a key.
      expect(src, `missing SOURCE_DETAILS entry for ${name}`).toContain(`"${name}":`);
    }
  });
});
