/**
 * ENG-1020 polish fixes — source-regex guard pins (mobile side).
 *
 * The 2026-06-10 e2e walk surfaced four small Plan/Today polish regressions.
 * These pins lock the mobile fixes against silent reversion (mirror the
 * existing `plannerMicrocopyDc12` / `todayMealsSectionTd4` source-regex pin
 * style). Web parity pins live in `tests/unit/eng1020Polish.test.ts`.
 *
 *   #4 — single-item meal dedup guard exists in TodayMealsSection.
 *   #5 — no "Bfast" return path; add-slot chips read the full "Breakfast".
 *   #6 — the Plan week-date is rendered once (card eyebrow), the duplicate
 *        page subheader was removed.
 *   #7 — the "% of kcal" caption uses a neutral text token (textSecondary),
 *        NOT the macro (amber/clay/warning) hue.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

const PLANNER = read("apps/mobile/app/(tabs)/planner.tsx");
const MEAL_NUTRITION = read("apps/mobile/app/meal-nutrition.tsx");
const TODAY_MEALS = read("apps/mobile/components/today/TodayMealsSection.tsx");

describe("ENG-1020 #5 — add-slot chips read 'Breakfast', no 'Bfast' return (mobile)", () => {
  it("compactPlanSlotLabel returns full 'Breakfast' for the breakfast slot", () => {
    expect(PLANNER).toMatch(/function compactPlanSlotLabel/);
    expect(PLANNER).toMatch(/case "Breakfast":\s*\n\s*return "Breakfast";/);
  });

  it("no 'Bfast' is returned from any code path", () => {
    // "Bfast" survives only in the explanatory comment, never as a returned
    // value (the abbreviation that read as a typo on the e2e walk).
    expect(PLANNER).not.toMatch(/return "Bfast"/);
  });
});

describe("ENG-1020 #6 — Plan week-date rendered once (mobile)", () => {
  it("keeps the single summary-card eyebrow ('… · Meal plan')", () => {
    expect(PLANNER).toMatch(/summaryOverline/);
    expect(PLANNER).toMatch(/· Meal plan/);
  });

  it("removed the duplicate week-date page subheader source", () => {
    // The redundant overline helper + "Week of" subheader string are gone.
    expect(PLANNER).not.toMatch(/getWeekOfLabel\s*[=(]/);
    expect(PLANNER).not.toMatch(/`Week of \$\{/);
  });
});

describe("ENG-1020 #7 — '% of kcal' caption uses a neutral text token (mobile)", () => {
  it("paints the caption in textSecondary, not the macro hue", () => {
    // The caption "{pct}% of kcal" reads in the neutral secondary text colour.
    expect(MEAL_NUTRITION).toMatch(
      /color:\s*colors\.textSecondary\s*\}\}>\{pct\}% of kcal/,
    );
    // It must NOT be painted with the per-macro hue (`color`, amber for fat).
    expect(MEAL_NUTRITION).not.toMatch(/color:\s*color\s*\}\}>\{pct\}% of kcal/);
  });
});

describe("ENG-1020 #4 — single-item meal dedup guard exists in TodayMealsSection (mobile)", () => {
  it("guards the redundant single row by header-title equality", () => {
    expect(TODAY_MEALS).toMatch(/redundantSingleRow\s*=/);
    expect(TODAY_MEALS).toMatch(/meals\.length === 1/);
    expect(TODAY_MEALS).toMatch(/figmaSlotSummaryTitle\(meals\)/);
    // Renders null for the duplicate row (suppression), not the row.
    expect(TODAY_MEALS).toMatch(/redundantSingleRow[\s\S]{0,80}\?\s*null/);
  });
});
