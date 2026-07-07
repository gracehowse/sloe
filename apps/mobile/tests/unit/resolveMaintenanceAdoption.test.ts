import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * F-3 parity pin (2026-04-19, TestFlight `ADFYpDgEEb0QH-j3BXshPTo`).
 * Both Today screens and both Progress screens must resolve the
 * Maintenance tile / card value through the shared
 * `src/lib/nutrition/resolveMaintenance.ts` helper. A future PR that
 * rolls its own inline adaptive-vs-formula branch would let the
 * two surfaces silently disagree again — this test fails loudly when
 * that happens.
 *
 * ENG-1360 (2026-07-07): web Today's `resolveMaintenance` call moved from
 * `NutritionTracker.tsx` into the extracted `useNutritionTrackerProfile`
 * hook it calls (pure data hook, same profiles-row fetch, same resolver —
 * just relocated). The adoption pin follows the call to its new home so it
 * keeps guarding the real thing: the web Today surface must still resolve
 * Maintenance through the shared helper, not a reinvented inline branch.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("resolveMaintenance adoption (F-3 parity pin)", () => {
  it("web Today (NutritionTracker, via useNutritionTrackerProfile) imports and calls resolveMaintenance", () => {
    const trackerSrc = read("src/app/components/NutritionTracker.tsx");
    expect(trackerSrc).toContain("useNutritionTrackerProfile");
    const hookSrc = read("src/lib/nutrition/useNutritionTrackerProfile.ts");
    expect(hookSrc).toMatch(/from ["'][^"']*resolveMaintenance(?:\.ts)?["']/);
    expect(hookSrc).toContain("resolveMaintenance(");
  });

  it("mobile Today (app/(tabs)/_today/TodayScreen.tsx) imports and calls resolveMaintenance", () => {
    const src = read("apps/mobile/app/(tabs)/_today/TodayScreen.tsx");
    expect(src).toMatch(/from ["'][^"']*resolveMaintenance(?:\.ts)?["']/);
    expect(src).toContain("resolveMaintenance(");
  });

  it("web Progress (ProgressDashboard) imports and calls resolveMaintenance", () => {
    const src = read("src/app/components/ProgressDashboard.tsx");
    expect(src).toMatch(/from ["'][^"']*resolveMaintenance(?:\.ts)?["']/);
    expect(src).toContain("resolveMaintenance(");
    // Title copy must have flipped from "Your TDEE" → "Maintenance".
    expect(src).toContain(">Maintenance<");
    expect(src).not.toContain(">Your TDEE<");
  });

  it("mobile Progress (app/(tabs)/progress.tsx) imports and calls resolveMaintenance", () => {
    const src = read("apps/mobile/app/(tabs)/progress.tsx");
    expect(src).toMatch(/from ["'][^"']*resolveMaintenance(?:\.ts)?["']/);
    expect(src).toContain("resolveMaintenance(");
    expect(src).toContain(">Maintenance</Text>");
    expect(src).not.toContain(">Your TDEE</Text>");
  });

  it("shared resolver exports `resolveMaintenance` and `buildMaintenancePopoverCopy`", () => {
    const src = read("src/lib/nutrition/resolveMaintenance.ts");
    expect(src).toContain("export function resolveMaintenance");
    expect(src).toContain("export function buildMaintenancePopoverCopy");
    expect(src).toContain("ADAPTIVE_STALE_DAYS");
  });
});
