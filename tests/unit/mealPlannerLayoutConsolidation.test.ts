/**
 * MealPlanner prototype-rewrite structural guard (2026-04-21).
 *
 * Pins the paste-level-fidelity rewrite of
 * `src/app/components/MealPlanner.tsx` against the Claude Design
 * prototype `WebPlan` (lines 250–323 of
 * `docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`).
 *
 * Grace rejected two prior consolidation passes because they
 * approximated the prototype. This test locks in the structural
 * invariants of the match:
 *   - title "Meal plan" + subtitle with "hits targets N of M days"
 *   - 7-column grid of day cards (grid-cols-7)
 *   - `breakfast / lunch / dinner` slot blocks (snacks NOT in grid)
 *   - swap button per slot
 *   - Shopping list + Regenerate week CTAs
 *   - no progress summary card, no per-day macro pills, no
 *     horizontal day scroller, no named-plans card, no pre-gen
 *     settings, no DailyRing/MacroCard, no drag-drop/Move/Cook/Log
 *     affordances, no smart-suggestions block
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/MealPlanner.tsx"),
  "utf8",
);

describe("MealPlanner prototype rewrite (2026-04-21)", () => {
  it("renders the 24px 'Meal plan' title", () => {
    expect(SRC).toMatch(/Meal plan/);
    expect(SRC).toMatch(/fontSize: 24/);
  });

  it("subtitle carries the 'hits targets N of M day(s)' pattern", () => {
    expect(SRC).toMatch(/hits targets \$\{summary\.hits\} of \$\{summary\.total\}/);
  });

  it("renders the 7-column day grid and breakfast/lunch/dinner slots only", () => {
    expect(SRC).toMatch(/md:grid-cols-7/);
    expect(SRC).toMatch(/\["breakfast", "lunch", "dinner"\]/);
    // Snacks explicitly NOT present in the grid slot list.
    expect(SRC).not.toMatch(/"breakfast", "lunch", "dinner", "snacks"/);
  });

  it("has a swap button per slot and a Today pill for today's column", () => {
    expect(SRC).toMatch(/Swap \$\{slot\}/);
    expect(SRC).toMatch(/planner-desktop-today-pill-/);
  });

  it("renders the Shopping list + Regenerate week CTA row", () => {
    expect(SRC).toMatch(/Shopping list/);
    expect(SRC).toMatch(/Regenerate week/);
  });

  it("does NOT render the removed legacy blocks", () => {
    expect(SRC).not.toMatch(/>Plan summary · daily average</);
    expect(SRC).not.toMatch(/Today&apos;s plan/);
    expect(SRC).not.toMatch(/data-testid="plan-week-summary-card"/);
    expect(SRC).not.toMatch(/>Named plans</);
    expect(SRC).not.toMatch(/>Logging your day</);
    expect(SRC).not.toMatch(/data-testid=[`"]day-macro-pills-/);
    expect(SRC).not.toMatch(/>Smart suggestions</);
    expect(SRC).not.toMatch(/>Plan Duration</);
    expect(SRC).not.toMatch(/from "\.\/suppr\/daily-ring"/);
    expect(SRC).not.toMatch(/from "\.\/suppr\/macro-card"/);
    expect(SRC).not.toMatch(/<DailyRing[\s>]/);
    expect(SRC).not.toMatch(/<MacroCard[\s>]/);
    // No drag-drop / Move / Cook / Log buttons on the plan surface.
    expect(SRC).not.toMatch(/onDragStart/);
    expect(SRC).not.toMatch(/handleMoveMeal/);
    expect(SRC).not.toMatch(/logPlannedMeal/);
    // No pre-generation settings accordion.
    expect(SRC).not.toMatch(/Daily targets \(optimizer\)/);
    expect(SRC).not.toMatch(/Calorie band/);
  });
});
