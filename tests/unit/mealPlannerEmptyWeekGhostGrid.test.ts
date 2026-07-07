/**
 * MealPlanner — empty-week ghost grid (ENG-1372 slice 1, web legacy grid).
 *
 * Behind `empty_state_grammar_v1`: when the whole week has zero real meals
 * (`showEmptyWeekGhostGrid`, from `usePlanEmptyWeekGhostGrid` — the extracted
 * hook keeping this pinned screen file lean), every empty kanban cell
 * collapses to a whisper-weight `PlanGhostSlotPill` instead of repeating
 * "Aim ~X kcal" ×7, and the aim triple renders ONCE as a `PlanWeekAimLegend`
 * above the grid. Source-text assertions — the established convention for
 * this heavily context-dependent screen (see
 * `mealPlannerElevationAndWinPulse.test.ts`).
 *
 * This is the LEGACY 7-column grid (`sloe_v3_plan` off, the only web Plan
 * surface currently live); the v3 surface's parallel fix is
 * `tests/unit/planEmptyWeekGrammarWeb.test.tsx` (PlanV3Surface).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/MealPlanner.tsx"),
  "utf8",
);
const HOOK_SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/plan/usePlanEmptyWeekGhostGrid.ts"),
  "utf8",
);

describe("MealPlanner — empty-week ghost grid wiring (ENG-1372)", () => {
  it("derives showEmptyWeekGhostGrid + weekAimLegendSlots from the extracted hook", () => {
    expect(SRC).toContain(
      "usePlanEmptyWeekGhostGrid(showSummaryCard, planHasRealMeals, daySlots, canonicalSlotAim)",
    );
  });

  it("renders the legend once, gated on showEmptyWeekGhostGrid, ABOVE the kanban grid", () => {
    const legendIdx = SRC.indexOf("<PlanWeekAimLegend");
    const kanbanIdx = SRC.indexOf('data-testid="planner-desktop-kanban"');
    expect(legendIdx).toBeGreaterThan(-1);
    expect(kanbanIdx).toBeGreaterThan(-1);
    expect(legendIdx).toBeLessThan(kanbanIdx);
    expect(SRC).toContain("showEmptyWeekGhostGrid");
    expect(SRC).toMatch(/showEmptyWeekGhostGrid[^)]*\?\s*<PlanWeekAimLegend/);
  });

  it("collapses BOTH empty-cell code paths (no-entry AND placeholder-entry) to the ghost pill", () => {
    // Path 1 — `bySlot` has no entry at all for this slot (e.g. shrunk numbered preset).
    expect(SRC).toMatch(
      /if \(!entry\) \{\s*\n\s*if \(showEmptyWeekGhostGrid\) return <PlanGhostSlotPill/,
    );
    // Path 2 — `bySlot` has an entry but it's a placeholder (the generate-created
    // scaffolding row every fresh plan actually produces).
    expect(SRC).toContain(
      "if (showEmptyWeekGhostGrid && isPlaceholder) return <PlanGhostSlotPill",
    );
  });

  it("imports PlanGhostSlotPill + PlanWeekAimLegend from the shared empty-week-grid module", () => {
    expect(SRC).toContain(
      'import { PlanGhostSlotPill, PlanWeekAimLegend } from "./suppr/plan-empty-week-grid.tsx"',
    );
  });
});

describe("usePlanEmptyWeekGhostGrid (extracted hook)", () => {
  it("gates on empty_state_grammar_v1 AND showSummaryCard AND !planHasRealMeals", () => {
    expect(HOOK_SRC).toMatch(
      /isFeatureEnabled\("empty_state_grammar_v1"\)\s*&&\s*showSummaryCard\s*&&\s*!planHasRealMeals/,
    );
  });

  it("derives the legend slots straight from canonicalSlotAim (can't drift from the per-cell number)", () => {
    expect(HOOK_SRC).toContain("canonicalSlotAim[s.toLowerCase()]");
  });
});
