/**
 * DC12 (2026-05-14, premium-bar audit microcopy sweep) — log
 * confirmations.
 *
 * Pins the "{mealName} logged" shape (title carries the noun) on
 * every successful-log alert across the mobile log paths:
 *
 *   - Today food-search flow (Today index)
 *   - Today custom-food save (sibling alert)
 *   - Barcode scan + manual barcode entry
 *   - Recipe detail "Log to today"
 *   - Plan-tab "Log as planned" (both inline + overflow menu)
 *
 * Previously every alert title was the bare verb "Logged" /
 * "Saved" with the meal name relegated to the body. The audit
 * found that on iOS the alert title is bolder + larger, so
 * surfacing the meal name there reads back what the user just
 * logged (Cal AI / MFP parity).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PATHS = {
  todayIndex: resolve(__dirname, "../../app/(tabs)/_today/TodayScreen.tsx"),
  barcode: resolve(__dirname, "../../app/(tabs)/barcode.tsx"),
  planner: resolve(__dirname, "../../app/(tabs)/planner.tsx"),
  recipeDetail: resolve(__dirname, "../../app/recipe/[id].tsx"),
};

function readSrc(p: string): string {
  return readFileSync(p, "utf8");
}

describe("Log confirmation microcopy (DC12)", () => {
  it("Today food-search alert title surfaces the product name", () => {
    const src = readSrc(PATHS.todayIndex);
    expect(src).toContain('Alert.alert(`${product.name} logged`');
  });

  it("Today custom-food save title is 'Custom food saved' (specific)", () => {
    const src = readSrc(PATHS.todayIndex);
    expect(src).toContain('"Custom food saved"');
  });

  it("Barcode scan + manual entry alerts surface the meal name", () => {
    const src = readSrc(PATHS.barcode);
    expect(src).toContain('Alert.alert(`${product.name} logged`');
    expect(src).toContain('Alert.alert(`${manualName.trim()} logged`');
  });

  it("Plan tab Log-as-planned alert surfaces the recipe title", () => {
    // ENG-1344 — this site is now flag-gated through `alertOrToast`, which
    // falls back to the identical `Alert.alert(title, message)` shape when
    // `plan_alert_to_toast_v1` is off; the recipe title still leads the
    // confirmation either way. See `alertOrToast.test.ts` for the
    // flag-branching behaviour itself.
    const src = readSrc(PATHS.planner);
    expect(src).toContain('alertOrToast(toast.showToast, `${meal.recipeTitle} logged`');
  });

  it("Recipe detail Log-to-today alert surfaces the recipe title", () => {
    const src = readSrc(PATHS.recipeDetail);
    expect(src).toContain('Alert.alert(`${recipe.title} logged`');
  });

  it("none of the canonical log paths still ship the bare 'Logged' title", () => {
    // The bare-verb title was the pre-DC12 default. A regression here
    // would re-introduce the cold confirmation pattern.
    for (const p of Object.values(PATHS)) {
      const src = readSrc(p);
      expect(
        src,
        `bare-verb "Logged" alert detected in ${p}`,
      ).not.toMatch(/Alert\.alert\("Logged"/);
    }
  });
});
