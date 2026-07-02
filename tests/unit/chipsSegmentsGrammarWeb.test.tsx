/**
 * Chips / segments / tags grammar (WEB) — §7/§8 convergence (ENG-1022).
 *
 * Web parity for the mobile chips census shipped 2026-06-10
 * (`apps/mobile/components/ui/SubTabPill.tsx`,
 *  `apps/mobile/components/progress/ProgressPeriodControl.tsx`,
 *  `apps/mobile/components/today/LogSheet.tsx` slotPill,
 *  `apps/mobile/app/(tabs)/planner.tsx` dayBtn).
 *
 * The grammar (mirror of the mobile §7/§8 rules):
 *   §7 round option/filter chips — `rounded-full`; the soft tint IS the
 *      selection signal: `bg-primary-soft` / `bg-primary/10` fill +
 *      `border-primary-soft` / `border-primary/10` (a TINT edge), never a
 *      solid `border-primary` accent ring. Selected label = `primary-solid`
 *      (or `foreground` where contrast on the 10% tint requires it).
 *   §8 segmented controls — one container treatment: `rounded-full` rail +
 *      `rounded-full` segments, active thumb = white lift
 *      (`bg-background`/`bg-card` + `shadow-sm`) + `primary-solid` label.
 *
 * Source-level structural pins. They break if a converged element regresses
 * to the pre-ENG-1022 drift (square `rounded-md`/`rounded-lg`/`rounded-xl`
 * segments, or a solid `border-primary` accent ring on a soft-tint chip), so
 * the convergence can't silently drift and web ↔ mobile stay in lock-step.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const FILTER_CHIP = read("src/app/components/ui/filter-chip.tsx");
const SETTINGS = read("src/app/components/Settings.tsx");
const FOOD_SEARCH = read("src/app/components/food-search/FoodSearchPanel.tsx");
const LOG_SHEET = read("src/app/components/suppr/log-sheet.tsx");
const QUICK_ADD = read("src/app/components/suppr/quick-add-panel.tsx");
const MEAL_PLANNER = read("src/app/components/MealPlanner.tsx");
const MACRO_DETAIL = read("src/app/components/MacroDetailPanel.tsx");
const PROGRESS = read("src/app/components/ProgressDashboard.tsx");
const PERIOD_CONTROL = read("src/app/components/suppr/progress-period-control.tsx");

describe("§8 segmented controls — fully-round rail + segments (web parity)", () => {
  it("LogSheet browse tabs (Recent/Favourites/My recipes): Figma underline rail (ENG-900)", () => {
    expect(LOG_SHEET).toMatch(/border-b border-border/);
    expect(LOG_SHEET).toMatch(/border-b-2/);
    expect(LOG_SHEET).toMatch(/border-foreground font-semibold text-foreground/);
    expect(LOG_SHEET).toMatch(/border-transparent font-normal text-muted-foreground/);
  });

  it("MacroDetail breakdown toggle: round rail + round segments + primary-solid label", () => {
    expect(MACRO_DETAIL).toMatch(/rounded-full bg-muted p-0\.5/);
    expect(MACRO_DETAIL).toMatch(/flex-1 rounded-full py-1\.5/);
    expect(MACRO_DETAIL).toMatch(/"bg-card font-semibold text-primary-solid shadow-sm"/);
  });

  it("ProgressDashboard weight Trend/Scale toggle: round rail + round segments", () => {
    expect(PROGRESS).toMatch(/rounded-full bg-muted p-0\.5/);
    expect(PROGRESS).toMatch(/rounded-full px-3 py-1[\s\S]{0,80}font-semibold/);
    expect(PROGRESS).toMatch(/"bg-card text-primary-solid shadow-sm"/);
  });

  it("Progress D/W/M/6M/Y period segments: round + bg-primary-soft active (no ring)", () => {
    expect(PERIOD_CONTROL).toMatch(/flex-1 rounded-full py-1\.5/);
    expect(PERIOD_CONTROL).toMatch(/"bg-primary-soft text-primary-solid font-semibold"/);
    // No square segmented thumb survived the convergence
    expect(PERIOD_CONTROL).not.toMatch(/rounded-md py|rounded-lg py|rounded-xl py/);
  });
});

describe("§7 option/filter chips — tint IS the signal, no solid accent ring", () => {
  it("LogSheet slot row pills: round + bg-primary-soft fill + border-primary-soft (no border-primary ring)", () => {
    expect(LOG_SHEET).toMatch(/flex-1 rounded-full border px-2 py-1\.5/);
    expect(LOG_SHEET).toMatch(/"border-primary-soft bg-primary-soft text-foreground"/);
    // The pre-ENG-1022 solid accent ring on the slot pill is gone.
    expect(LOG_SHEET).not.toMatch(/"border-primary bg-primary\/10 text-foreground"/);
  });

  it("QuickAdd tab pills: rounded-md (4px, matches mobile Radius.sm) + soft tint", () => {
    expect(QUICK_ADD).toMatch(/rounded-md text-\[11px\] font-bold uppercase/);
    expect(QUICK_ADD).toMatch(/active \? "bg-primary\/10 text-primary-solid"/);
  });

  it("MealPlanner Plan-length + Start + Slot pills: round + bg-primary/10 + border-primary/10 (no solid ring)", () => {
    const tintRing = MEAL_PLANNER.match(/"border-primary\/10 bg-primary\/10 text-primary-solid"/g) ?? [];
    // Plan-length (1/3/7), Start (Today/Tomorrow/Next week), and the Slot
    // include toggles — all three round §7 pill rows share the treatment.
    expect(tintRing.length).toBeGreaterThanOrEqual(3);
    // The pre-ENG-1022 solid accent ring on these round pills is gone.
    expect(MEAL_PLANNER).not.toMatch(/"border-primary bg-primary\/10 text-primary-solid"/);
  });

  it("FilterChip primitive: rounded-full + primary-soft selected, card rest, no border-primary ring", () => {
    expect(FILTER_CHIP).toMatch(/rounded-full/);
    expect(FILTER_CHIP).toMatch(/bg-primary-soft text-primary-solid font-semibold/);
    expect(FILTER_CHIP).toMatch(/bg-card text-muted-foreground font-medium/);
    expect(FILTER_CHIP).not.toMatch(/border-primary/);
  });

  it("Settings dietary restrictions use FilterChip (no rounded-lg border-2 drift)", () => {
    expect(SETTINGS).toMatch(/<FilterChip/);
    expect(SETTINGS).toMatch(/settings-dietary-/);
    expect(SETTINGS).not.toMatch(/rounded-lg border-2[\s\S]{0,120}border-primary bg-primary\/10/);
  });

  it("FoodSearchPanel category filters use FilterChip", () => {
    expect(FOOD_SEARCH).toMatch(/<FilterChip/);
    expect(FOOD_SEARCH).toMatch(/food-search-category-/);
  });
});
