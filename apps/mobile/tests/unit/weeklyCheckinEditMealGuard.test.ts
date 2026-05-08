/**
 * build-45 bug fix (2026-05-08) — pin the weekly-checkin gate's
 * editingMeal / params.editMealId guards so they don't get
 * accidentally removed by a future agent. Grace's repro:
 *
 *   1. Tap a logged meal on Today → /meal-nutrition opens
 *   2. Tap Edit on that screen → navigate back with `?editMealId=...`
 *   3. TodayEditMealModal opens via the edit-meal-on-return useEffect
 *   4. Weekly check-in useEffect re-fires on the same focus event
 *      → WeeklyCheckinModal also opens
 *   5. Both modals stack at the RN Modal level → iOS blocks input on
 *      the back one → page freezes
 *
 * The fix early-outs the weekly-checkin useEffect when the edit-meal
 * flow is in progress (either editingMeal is non-null OR the
 * editMealId param is present from the meal-nutrition screen return).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const SRC = readFileSync(
  resolve(REPO, "apps/mobile/app/(tabs)/index.tsx"),
  "utf8",
);

describe("build-45 fix — weekly check-in skips when edit-meal flow is active", () => {
  it("skips when editingMeal is non-null (modal already showing)", () => {
    // The guard sits inside the weekly-checkin useEffect, before the
    // eligibility gate. Match the early-out pattern.
    expect(SRC).toMatch(/if\s*\(editingMeal\s*!=\s*null\)\s*return\s*;/);
  });

  it("skips when navigating back from /meal-nutrition with editMealId param", () => {
    expect(SRC).toMatch(
      /if\s*\(typeof\s+params\.editMealId\s*===\s*["']string["']\s*&&\s*params\.editMealId\.length\s*>\s*0\)\s*return\s*;/,
    );
  });

  it("editingMeal + params.editMealId are in the useEffect deps array", () => {
    // Grep the deps array containing weeklyCheckinShownAt — that's the
    // weekly-checkin useEffect's deps. Both new triggers must be deps
    // so the gate re-evaluates when the edit flow opens / closes.
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
