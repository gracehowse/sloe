/**
 * ENG-1020 polish fixes — source-regex guard pins (web side).
 *
 * The 2026-06-10 e2e walk surfaced small Plan/Today polish regressions.
 * These pins lock the fixes against silent reversion (mirror the existing
 * `planAddSlotChips` / `todayCardElevationSweep` source-regex pin style).
 * Mobile parity pins live in `apps/mobile/tests/unit/eng1020Polish.test.tsx`.
 *
 *   #5 — no "Bfast" abbreviation; add-slot chips read the full "Breakfast".
 *   #6 — the Plan week-date is rendered once (card eyebrow), the duplicate
 *        page subtitle/subheader was removed.
 *   #7 — the "% of kcal" caption uses a neutral text token, NOT the macro
 *        (amber/clay/warning) hue.
 *
 * (#4 — the single-item meal dedup guard — was scoped to the Figma summary
 * layout, deleted in ENG-1096; its pin is removed with the layout.)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

const MEAL_PLANNER = read("src/app/components/MealPlanner.tsx");
const MEAL_NUTRITION_DIALOG = read("src/app/components/suppr/meal-nutrition-dialog.tsx");

describe("ENG-1020 #5 — no 'Bfast' abbreviation; add-slot chips read 'Breakfast' (web)", () => {
  it("web add-slot chip label resolves breakfast → full 'Breakfast'", () => {
    // SLOT_TITLE is the lookup the add-slot chip renders (`SLOT_TITLE[slot]`).
    expect(MEAL_PLANNER).toMatch(/breakfast:\s*"Breakfast"/);
    expect(MEAL_PLANNER).toMatch(/\{SLOT_TITLE\[slot\]\}/);
  });

  it("no 'Bfast' literal survives anywhere in MealPlanner", () => {
    expect(MEAL_PLANNER).not.toMatch(/Bfast/);
  });
});

describe("ENG-1020 #6 — Plan week-date rendered once (web)", () => {
  it("keeps the single card eyebrow source ('… · Meal plan')", () => {
    // The kept source: the summary-card eyebrow carries the week span.
    expect(MEAL_PLANNER).toMatch(/weekRangeEyebrow/);
    expect(MEAL_PLANNER).toMatch(/· Meal plan/);
  });

  it("removed the duplicate 'Week of {date}' page subtitle render", () => {
    // The redundant subtitle was a `Week of ${...}` template literal; it must
    // not render anywhere in the planner. (The phrase survives only inside the
    // explanatory ENG-1020 comment documenting the removal, never as code.)
    expect(MEAL_PLANNER).not.toMatch(/`Week of \$\{/);
  });
});

describe("ENG-1020 #7 → ENG-1247 — per-macro '% of kcal' removed from meal-detail (web)", () => {
  it("no longer renders an inline '% of kcal' caption (the v3 grid shows grams only)", () => {
    // ENG-1247: the v3 `.md-totalgrid` replaced the per-macro grams+% rows. The
    // share-of-energy detail moved to the tap-through MacroDetailPanel, so the
    // dialog no longer paints a "% of kcal" caption at all — which also closes the
    // ENG-1020 #7 amber-misread risk by removing the surface entirely.
    expect(MEAL_NUTRITION_DIALOG).not.toMatch(/% of kcal/);
    // The 4-cell grid is what renders the per-macro grams now.
    expect(MEAL_NUTRITION_DIALOG).toMatch(/MacroTotalGrid/);
  });
});

