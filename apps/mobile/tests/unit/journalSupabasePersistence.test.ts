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
// ENG (2026-06-12, launch-audit P1-1/P1-2) — the per-column row shape
// (`canonicalNutritionEntrySource`, `recipe_id`, `eaten_at`, `date_key`) moved
// out of the inline literal in `persistMealsImmediate` into the single shared
// row-builder so the immediate path and the 600ms backstop cannot diverge on
// the upsert column set. Pin the builder file too, not just the call site.
const ROW_BUILDER_SRC = readFileSync(
  resolve(REPO, "apps/mobile/lib/nutritionEntryRow.ts"),
  "utf8",
);

describe("Today journal — every meal-add path persists to Supabase immediately", () => {
  it("declares persistMealsImmediate helper that upserts nutrition_entries via the shared row-builder", () => {
    expect(SRC).toMatch(/const\s+persistMealsImmediate\s*=\s*useCallback/);
    // Helper body must hit the `nutrition_entries` upsert.
    const idx = SRC.indexOf("const persistMealsImmediate");
    const slice = SRC.slice(idx, idx + 4000);
    expect(slice).toMatch(/from\(["']nutrition_entries["']\)\s*\.upsert/);
    // Rows come from the single shared builder (no inline column literal that
    // could drift from the backstop).
    expect(slice).toMatch(
      /meals\.map\(\(m\)\s*=>\s*buildNutritionEntryRow\(m,\s*targetDayKey,\s*userId,\s*profileTimeZone\)/,
    );
    // ENG-1125 — failed upserts queue for retry instead of rolling back UI.
    expect(slice).toMatch(/enqueueJournalUpserts/);
    expect(slice).toMatch(/Saved on this device/);
  });

  it("the shared row-builder is the source of the canonical source, recipe_id and eaten_at columns", () => {
    // These columns moved out of the inline literal into the builder — pin
    // them where they now live so dropping `eaten_at`/`recipe_id`/the
    // canonical source from a write still fails a test.
    expect(ROW_BUILDER_SRC).toMatch(/canonicalNutritionEntrySource/);
    expect(ROW_BUILDER_SRC).toMatch(/recipe_id:\s*meal\.recipeId/);
    expect(ROW_BUILDER_SRC).toMatch(/eaten_at:\s*eatenAt/);
    // date_key is the eaten-derived attribution, not a hard-coded anchor.
    expect(ROW_BUILDER_SRC).toMatch(/nutritionEntryDateKeyAndEatenAt/);
  });

  it("declares persistMealUpdateImmediate helper for edit-meal", () => {
    expect(SRC).toMatch(/const\s+persistMealUpdateImmediate\s*=\s*useCallback/);
    const idx = SRC.indexOf("const persistMealUpdateImmediate");
    const slice = SRC.slice(idx, idx + 2500);
    expect(slice).toMatch(/from\(["']nutrition_entries["']\)\s*\.update/);
    expect(slice).toMatch(/\.eq\(["']id["']/);
    expect(slice).toMatch(/\.eq\(["']user_id["']/);
    // ENG-1125 — failed updates queue for retry instead of rolling back UI.
    expect(slice).toMatch(/enqueueJournalUpserts/);
    expect(slice).toMatch(/Saved on this device/);
  });

  it("insertClonedRowsIntoDay queues failed bulk copy inserts instead of rolling back", () => {
    expect(SRC).toMatch(/const\s+insertClonedRowsIntoDay\s*=\s*useCallback/);
    const idx = SRC.indexOf("const insertClonedRowsIntoDay");
    const slice = SRC.slice(idx, idx + 3500);
    expect(slice).toMatch(/from\(["']nutrition_entries["']\)\s*\.insert/);
    expect(slice).toMatch(/enqueueJournalUpserts/);
    expect(slice).toMatch(/Saved on this device/);
    expect(slice).not.toMatch(/Couldn't copy/);
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
    // ENG-772 eaten_at resolution pushed the callback past 2k chars.
    const slice = SRC.slice(idx, idx + 4000);
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

  it("id-format gating lives in the shared builder, not a screen-local regex", () => {
    // The 2026-05-08 data-loss hotfix lifted a per-render UUID_RE to module
    // scope; the launch-audit P1-2 consolidation then moved id re-minting
    // into `buildNutritionEntryRow` (NUTRITION_ENTRY_UUID_RE). Pin that the
    // screen no longer carries its own copy — a reintroduced local regex
    // would mean a second, divergeable id-gating path.
    expect(SRC).not.toMatch(/const\s+UUID_RE\s*=/);
    expect(SRC).toMatch(/buildNutritionEntryRow\(/);
  });
});
