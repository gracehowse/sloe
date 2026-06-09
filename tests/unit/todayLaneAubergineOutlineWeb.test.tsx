/**
 * Today tab + Log sheet lane (WEB) — Sloe aubergine-outline treatment
 * (2026-06-08). Web parity for `apps/mobile/tests/unit/todayLaneAubergineOutline.test.ts`.
 *
 * The Sloe component-treatment system (docs/prototypes/sloe-component-
 * treatments.html) rations the accent: the FAB + conversion CTAs (paywall /
 * onboarding) keep a filled aubergine, but every *everyday* primary CTA on
 * the Today surface + Log sheet reads as an aubergine OUTLINE —
 * `border-[1.5px] border-primary-solid bg-transparent text-primary-solid`,
 * NOT a filled `bg-primary text-primary-foreground` slab. Filter pills +
 * segmented controls carry the accent as a SOFT tint (`bg-primary/10` +
 * `text-primary-solid`), never a solid fill. "Browse" is a SECONDARY
 * off-white fill (`bg-secondary`).
 *
 * Source-level structural pins (mirror `sloeContrastUsage`). They break if
 * any CTA regresses to a filled `bg-primary text-primary-foreground` slab so
 * the reskin can't silently drift, and they keep web ↔ mobile in lock-step.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const NORTH_STAR = read("src/app/components/suppr/north-star-block.tsx");
const EAT_AGAIN = read("src/app/components/suppr/today-eat-again-banner.tsx");
const FIRST_MEAL = read("src/app/components/suppr/today-first-meal-empty-state.tsx");
const COMPLETE_DAY = read("src/app/components/suppr/today-complete-day-dialog.tsx");
const MEALS_SECTION = read("src/app/components/suppr/today-meals-section.tsx");
const DATE_HEADER = read("src/app/components/suppr/today-date-header.tsx");
const SNAP = read("src/app/components/suppr/today-snap-shortcut.tsx");
const QUICK_ADD = read("src/app/components/suppr/quick-add-panel.tsx");
const LOG_SHEET = read("src/app/components/suppr/log-sheet.tsx");
const ADD_MEAL = read("src/app/components/suppr/today-add-meal-dialog.tsx");
const ACTIVITY_BONUS = read("src/app/components/suppr/today-activity-bonus-card.tsx");
const CHECKIN_DIALOG = read("src/app/components/suppr/weekly-checkin-dialog.tsx");
const MILESTONE = read("src/app/components/suppr/milestone-30-day-dialog.tsx");
const TRACKER = read("src/app/components/NutritionTracker.tsx");

const OUTLINE = /border-\[1\.5px\]\s+border-primary-solid[\s\S]{0,80}text-primary-solid/;
// A filled primary CTA slab — what the everyday CTAs must NOT be.
const FILLED_SLAB = /bg-primary\s+(?:px-|py-|text-primary-foreground)/;

describe("Today lane (web) — aubergine OUTLINE primary CTAs", () => {
  it("North-star CTA is an outline, not the old bg-primary/10 tint", () => {
    expect(NORTH_STAR).toMatch(/border-\[1\.5px\]\s+border-primary-solid bg-transparent px-3 text-\[13px\] font-semibold text-primary-solid/);
  });

  it("Eat-again 'Log it' CTA is an outline on a soft-tint nudge card", () => {
    expect(EAT_AGAIN).toMatch(/bg-primary\/10/); // nudge card wash
    expect(EAT_AGAIN).toMatch(/border-\[1\.5px\]\s+border-primary-solid[\s\S]{0,80}text-primary-solid/);
  });

  it("First-meal empty 'Log a meal' CTA is an aubergine outline", () => {
    expect(FIRST_MEAL).toMatch(OUTLINE);
    expect(FIRST_MEAL).not.toMatch(FILLED_SLAB);
  });

  it("Meals-section empty 'Log a meal' CTA is an aubergine outline", () => {
    expect(MEALS_SECTION).toMatch(OUTLINE);
  });

  it("Complete-day dialog 'View my progress' is an aubergine outline", () => {
    expect(COMPLETE_DAY).toMatch(OUTLINE);
    expect(COMPLETE_DAY).not.toMatch(FILLED_SLAB);
  });

  it("Today 'Complete Day' button (NutritionTracker) is an aubergine outline", () => {
    expect(TRACKER).toMatch(/border-\[1\.5px\]\s+border-primary-solid bg-transparent text-primary-solid[\s\S]{0,160}>\s*Complete Day/);
  });

  it("Weekly check-in dialog 'Accept new target' is an aubergine outline", () => {
    expect(CHECKIN_DIALOG).toMatch(OUTLINE);
  });

  it("Milestone dialog 'Keep going' is an aubergine outline", () => {
    expect(MILESTONE).toMatch(OUTLINE);
    expect(MILESTONE).not.toMatch(FILLED_SLAB);
  });

  it("Activity-bonus discover CTA is an aubergine outline", () => {
    expect(ACTIVITY_BONUS).toMatch(OUTLINE);
  });

  it("Log sheet 'Done' + barcode 'Log it' are aubergine outlines; 'Browse recipes' is a secondary", () => {
    const outlineMatches = LOG_SHEET.match(/border-\[1\.5px\]\s+border-primary-solid/g) ?? [];
    expect(outlineMatches.length).toBeGreaterThanOrEqual(2);
    // Browse recipes empty state is an off-white secondary (bg-secondary +
    // ink label), not a filled accent.
    expect(LOG_SHEET).toMatch(/bg-secondary px-5 text-\[13px\] font-bold text-foreground/);
    expect(LOG_SHEET).toMatch(/bg-secondary px-5[\s\S]{0,300}>\s*Browse recipes/);
  });

  it("Add-meal dialog 'Add meal' is an aubergine outline (per-instance Button override)", () => {
    expect(ADD_MEAL).toMatch(/border-\[1\.5px\]\s+border-primary-solid bg-transparent text-primary-solid/);
  });
});

describe("Today lane (web) — filter pills + segmented controls use the SOFT tint", () => {
  it("Quick-add tab pills: selected = bg-primary/10 + text-primary-solid (not a solid fill)", () => {
    expect(QUICK_ADD).toMatch(/active\s*\?\s*"bg-primary\/10 text-primary-solid"/);
    expect(QUICK_ADD).not.toMatch(/active\s*\?\s*"bg-primary text-primary-foreground"/);
  });

  it("Date-header day/week segmented control: active = bg-primary/10 + text-primary-solid", () => {
    const hits = DATE_HEADER.match(/"bg-primary\/10 text-primary-solid shadow-sm"/g) ?? [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it("Add-meal mode segmented control: active label = text-primary-solid", () => {
    expect(ADD_MEAL).toMatch(/"bg-card shadow text-primary-solid"/);
  });

  it("Log sheet browse segmented control: active label = text-primary-solid", () => {
    expect(LOG_SHEET).toMatch(/"bg-background text-primary-solid shadow-sm"/);
  });

  it("Snap shortcut Pro chip = bg-primary/10 + text-primary-solid; shutter glyph = primary-solid", () => {
    expect(SNAP).toMatch(/bg-primary\/10 px-1\.5 py-px text-\[9px\] font-extrabold tracking-wider text-primary-solid/);
    expect(SNAP).toMatch(/text-primary-solid/); // shutter glyph
  });
});
