/**
 * build-45 + build-47 fix (2026-05-08) — pin the weekly-checkin gate's
 * edit-flow suppression so the modal doesn't pop on every meal edit.
 *
 * Repro:
 *   1. Tap a logged meal on Today → /meal-nutrition opens
 *   2. Tap Edit on that screen → navigate back with `?editMealId=...`
 *   3. TodayEditMealModal opens via the edit-meal-on-return useEffect
 *   4. Weekly check-in useEffect re-fires on the same focus event
 *
 * Build-45 fix (PR #154): early-out when editingMeal != null OR
 * params.editMealId is present.
 *
 * Build-47 fix (THIS PR): the original early-out returned WITHOUT
 * setting `weeklyCheckinHandledRef.current = true`, so the moment
 * the edit modal closed (editingMeal goes null) the gate re-ran with
 * the guard cleared and the check-in fired immediately. Grace's TF
 * comment after build 47: "This keeps popping up every time I edit
 * an item".
 *
 * Post-fix: the edit-flow guard ALSO marks the check-in as handled
 * for the rest of this app session. The check-in eligibility is
 * once-per-week server-side; deferring to the next app launch is fine.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const SRC = readFileSync(
  resolve(REPO, "apps/mobile/app/(tabs)/index.tsx"),
  "utf8",
);

describe("build-45/47 fix — weekly check-in suppressed by edit-meal flow", () => {
  it("guard combines editingMeal + params.editMealId in a single OR-block", () => {
    // The combined OR-guard ensures both conditions trigger the same
    // suppression branch. Pre-fix used two separate `if` returns which
    // made it harder to also set handledRef in both places.
    expect(SRC).toMatch(
      /editingMeal\s*!=\s*null\s*\|\|[\s\S]{0,200}params\.editMealId\s*===\s*["']string["'][\s\S]{0,80}length\s*>\s*0/,
    );
  });

  it("edit-flow guard sets weeklyCheckinHandledRef.current = true (suppress for session)", () => {
    // Find the FIRST occurrence of `weeklyCheckinHandledRef.current = true`
    // — must be inside the edit-flow guard, BEFORE the eligibility CALL
    // (`shouldShowWeeklyCheckin({` invocation, not the import name).
    const handledIdx = SRC.indexOf("weeklyCheckinHandledRef.current = true");
    const eligCallIdx = SRC.indexOf("shouldShowWeeklyCheckin({");
    expect(handledIdx).toBeGreaterThan(-1);
    expect(eligCallIdx).toBeGreaterThan(-1);
    expect(handledIdx).toBeLessThan(eligCallIdx);
  });

  it("editingMeal + params.editMealId are in the useEffect deps array", () => {
    const depsMatch = SRC.match(
      /}, \[\s*isToday,\s*userId,[\s\S]{0,500}?weeklyCheckinShownAt,([\s\S]{0,200})\]\s*\)/,
    );
    expect(depsMatch, "weekly-checkin deps array must be findable").not.toBeNull();
    if (depsMatch) {
      const trailingDeps = depsMatch[1] ?? "";
      expect(trailingDeps).toContain("editingMeal");
      expect(trailingDeps).toContain("params.editMealId");
    }
  });
});
