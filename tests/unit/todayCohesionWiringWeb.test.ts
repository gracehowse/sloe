import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-1065 (TF57 F-158 / F-178 / F-179) — web parity source pins for the
 * Today-cohesion fixes. NutritionTracker is too large to mount here, so the
 * host-side wiring is pinned by reading source — mirrors the mobile pins in
 * `apps/mobile/tests/unit/todayCohesionWiring.test.ts`.
 */
const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

describe("Today cohesion — NutritionTracker web host wiring", () => {
  const src = read("../../src/app/components/NutritionTracker.tsx");

  it("F-178/F-179: Planned card mounts when populated OR the empty-state flag is on", () => {
    expect(src).toMatch(/isFeatureEnabled\("today_planned_empty_state"\)/);
    // The card is fed an empty array when there is no plan (drives the empty branch).
    expect(src).toMatch(/plannedMeals=\{mealPlan\?\.\[0\]\?\.meals \?\? \[\]\}/);
  });

  it("F-158: Complete-Day CTA is a SupprButton primary on the section rhythm, not old mt-4", () => {
    expect(src).toMatch(/Complete Day/);
    // ENG-1079: now <SupprButton variant="primary"> on the section cadence.
    // ENG-1099 M1: tierV1 drops mt-10 — parent space-y-6 owns spacing.
    expect(src).toMatch(/todaySectionBreakClass/);
    expect(src).toMatch(/<SupprButton[\s\S]{0,160}label="Complete Day"/);
    expect(src).not.toMatch(/transition-colors mt-4/);
  });
});

describe("Today cohesion — web TodayMealsSection ENG-1099 M6", () => {
  const src = read("../../src/app/components/suppr/today-meals-section.tsx");

  it("applies PressableScale-style press feedback on meal rows when tierV1 is on", () => {
    expect(src).toMatch(/todayMealRowPressClass/);
    expect(src).toMatch(/active:scale-\[0\.97\]/);
  });
});

describe("Today cohesion — web TodayPlannedMealsCard empty branch", () => {
  const src = read("../../src/app/components/suppr/today-planned-meals-card.tsx");

  it("renders the SAME 'Planned' header + a Plan-tab link in the empty state", () => {
    expect(src).toMatch(/Nothing planned for today/);
    expect(src).toMatch(/href="\/plan"/);
    expect(src).toMatch(/Plan your day/);
  });

  it("keeps the populated rows behind the non-empty branch", () => {
    expect(src).toMatch(/const isEmpty = plannedMeals\.length === 0/);
    expect(src).toMatch(/plannedMeals\.map/);
  });
});
