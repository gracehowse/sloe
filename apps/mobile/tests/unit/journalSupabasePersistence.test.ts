/**
 * 2026-05-08 data-loss hotfix — pin every meal-add path in the Today
 * screen to call `persistMealsImmediate` (or its update sibling) right
 * after `setByDay`. Pre-fix, the add paths wrote only to local state
 * and relied on a fragile 600ms debounced effect to drain to Supabase.
 * That effect cancels on any dep change before the 600ms elapses
 * (selected-day nav, follow-up state mutation, app background) → most
 * meals never made it to the server. Grace lost ~25 days of journal
 * data on TestFlight reinstall because of this.
 *
 * If a future agent adds a new meal-add path or removes one of the
 * persistence calls, this test surfaces it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const SRC = readFileSync(
  resolve(REPO, "apps/mobile/app/(tabs)/index.tsx"),
  "utf8",
);

describe("Today journal — every meal-add path persists to Supabase immediately", () => {
  it("declares persistMealsImmediate helper that inserts into nutrition_entries", () => {
    expect(SRC).toMatch(/const\s+persistMealsImmediate\s*=\s*useCallback/);
    // Helper body must hit `nutrition_entries` insert.
    const idx = SRC.indexOf("const persistMealsImmediate");
    const slice = SRC.slice(idx, idx + 4000);
    expect(slice).toMatch(/from\(["']nutrition_entries["']\)\s*\.insert/);
    // Must roll back optimistic UI on error.
    expect(slice).toMatch(/setByDay/);
    expect(slice).toMatch(/Couldn't save/);
  });

  it("declares persistMealUpdateImmediate helper for edit-meal", () => {
    expect(SRC).toMatch(/const\s+persistMealUpdateImmediate\s*=\s*useCallback/);
    const idx = SRC.indexOf("const persistMealUpdateImmediate");
    const slice = SRC.slice(idx, idx + 2000);
    expect(slice).toMatch(/from\(["']nutrition_entries["']\)\s*\.update/);
    expect(slice).toMatch(/\.eq\(["']id["']/);
    expect(slice).toMatch(/\.eq\(["']user_id["']/);
  });

  it("addMeal calls persistMealsImmediate (Quick Entry path)", () => {
    const idx = SRC.indexOf("const addMeal = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 1500);
    expect(slice).toMatch(/persistMealsImmediate\(dayKey,\s*\[meal\]\)/);
  });

  it("saveEditMeal calls persistMealUpdateImmediate", () => {
    const idx = SRC.indexOf("const saveEditMeal = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 2000);
    expect(slice).toMatch(/persistMealUpdateImmediate\(/);
  });

  it("logSavedMealFromPanel calls persistMealsImmediate", () => {
    const idx = SRC.indexOf("logSavedMealFromPanel");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 3000);
    expect(slice).toMatch(/persistMealsImmediate\(targetDayKey,\s*newMeals\)/);
  });

  it("logSavedMealFromSlotHeader calls persistMealsImmediate", () => {
    const idx = SRC.indexOf("logSavedMealFromSlotHeader");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 3000);
    expect(slice).toMatch(/persistMealsImmediate\(targetDayKey,\s*newMeals\)/);
  });

  it("logHistoryItemToSlot (Quick add / Eat-again) calls persistMealsImmediate", () => {
    const idx = SRC.indexOf("const logHistoryItemToSlot = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 3000);
    expect(slice).toMatch(/persistMealsImmediate\(dayKey,\s*\[meal\]\)/);
  });

  it("commitAiLoggedItems (AI photo/voice commit) calls persistMealsImmediate", () => {
    const idx = SRC.indexOf("const commitAiLoggedItems = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 3000);
    expect(slice).toMatch(/persistMealsImmediate\(dayKey,\s*newMeals\)/);
  });

  it("barcode onScan host (in (tabs)/index.tsx) calls persistMealsImmediate", () => {
    // The host wraps BarcodeScannerModal and on success appends a
    // single meal to byDay. Find the BarcodeScannerModal usage and
    // assert persistMealsImmediate is nearby.
    const idx = SRC.indexOf("<BarcodeScannerModal");
    expect(idx).toBeGreaterThan(-1);
    const slice = SRC.slice(idx, idx + 4000);
    expect(slice).toMatch(/persistMealsImmediate\(dayKey,\s*\[meal\]\)/);
  });

  it("UUID_RE is module-level (above the component) so persistMealsImmediate can use it", () => {
    // Pre-fix UUID_RE was a per-render `const` inside the component
    // (line ~3620). To let the persist helpers reference it from line
    // ~350, it had to move to module scope. Pin that.
    const componentStart = SRC.indexOf("export default function TrackerScreen");
    const uuidReDecl = SRC.match(/const\s+UUID_RE\s*=/);
    expect(uuidReDecl).not.toBeNull();
    if (uuidReDecl?.index != null) {
      expect(uuidReDecl.index).toBeLessThan(componentStart);
    }
    // And there's only ONE declaration (no leftover per-render dupe).
    const all = SRC.match(/const\s+UUID_RE\s*=/g);
    expect(all?.length ?? 0).toBe(1);
  });
});
