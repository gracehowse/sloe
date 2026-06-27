/**
 * ENG-1020 polish fixes — source-regex guard pins (mobile side).
 *
 * The 2026-06-10 e2e walk surfaced small Plan/Today polish regressions.
 * These pins lock the mobile fixes against silent reversion (mirror the
 * existing `plannerMicrocopyDc12` / `todayMealsSectionTd4` source-regex pin
 * style). Web parity pins live in `tests/unit/eng1020Polish.test.ts`.
 *
 *   #5 — no "Bfast" return path; add-slot chips read the full "Breakfast".
 *   #6 — the Plan week-date is rendered once (card eyebrow), the duplicate
 *        page subheader was removed.
 *   #7 — the "% of kcal" caption uses a neutral text token (textSecondary),
 *        NOT the macro (amber/clay/warning) hue.
 *
 * (#4 — the single-item meal dedup guard — was scoped to the Figma summary
 * layout, deleted in ENG-1096; its pin is removed with the layout.)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

const PLANNER = read("apps/mobile/app/(tabs)/planner.tsx");
const MEAL_NUTRITION = read("apps/mobile/app/meal-nutrition.tsx");

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

describe("ENG-1020 #7 → ENG-1247 — per-macro '% of kcal' removed from meal-detail (mobile)", () => {
  it("no longer renders an inline '% of kcal' caption (the v3 grid shows grams only)", () => {
    // ENG-1247: the v3 `.md-totalgrid` replaced the per-macro grams+% rows. The
    // share-of-energy detail moved to the tap-through macro-detail screen, so the
    // meal-detail no longer paints a "% of kcal" caption at all — which also
    // closes the ENG-1020 #7 amber-misread risk by removing the surface entirely.
    expect(MEAL_NUTRITION).not.toMatch(/% of kcal/);
    // The 4-cell grid is what renders the per-macro grams now.
    expect(MEAL_NUTRITION).toMatch(/MacroTotalGrid/);
  });
});

