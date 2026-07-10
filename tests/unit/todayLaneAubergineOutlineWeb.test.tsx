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
// EAT_AGAIN banner retired (ENG-984, 2026-06-17) — component deleted.
const FIRST_MEAL = read("src/app/components/suppr/today-first-meal-empty-state.tsx");
const COMPLETE_DAY = read("src/app/components/suppr/today-complete-day-dialog.tsx");
const MEALS_SECTION = read("src/app/components/suppr/today-meals-section.tsx");
const DATE_HEADER = read("src/app/components/suppr/today-date-header.tsx");
const SNAP = read("src/app/components/suppr/today-snap-shortcut.tsx");
const QUICK_ADD = read("src/app/components/suppr/quick-add-panel.tsx");
const LOG_SHEET = read("src/app/components/suppr/log-sheet.tsx");
// S13 LoggedConfirmation extracted from log-sheet.tsx (ENG-1484, screen-budget
// ratchet) — the Done/Undo confirmation CTAs live here now.
const LOG_SHEET_CONFIRMATION = read("src/app/components/suppr/log-sheet-confirmation.tsx");
const ADD_MEAL = read("src/app/components/suppr/today-add-meal-dialog.tsx");
const ACTIVITY_BONUS = read("src/app/components/suppr/today-activity-bonus-card.tsx");
const CHECKIN_DIALOG = read("src/app/components/suppr/weekly-checkin-dialog.tsx");
const MILESTONE = read("src/app/components/suppr/milestone-30-day-dialog.tsx");
const TRACKER = read("src/app/components/NutritionTracker.tsx");

const OUTLINE = /border-\[1\.5px\]\s+border-primary-solid[\s\S]{0,80}text-primary-solid/;
// A filled primary CTA slab — what the everyday CTAs must NOT be.
const FILLED_SLAB = /bg-primary\s+(?:px-|py-|text-primary-foreground)/;

describe("Today lane (web) — aubergine OUTLINE primary CTAs", () => {
  it("North-star 'what to eat next' CTA is a SOLID primary SupprButton", () => {
    // Button system migration (2026-06-12, ENG-1079): the card's ONE primary
    // action → `SupprButton` variant="primary" (solid aubergine fill, white
    // label, pill). Mobile parity: NorthStarBlock primary. Supersedes the old
    // aubergine-OUTLINE treatment.
    expect(NORTH_STAR).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr-button"/);
    expect(NORTH_STAR).toMatch(/<SupprButton\s+variant="primary"/);
    // Must NOT keep the retired aubergine outline.
    expect(NORTH_STAR).not.toMatch(OUTLINE);
  });

  // Eat-again 'Log it' CTA pin removed — the banner is retired (ENG-984,
  // 2026-06-17). Retirement is locked in `todayAboveMealsCap.test.ts`.

  it("First-meal empty 'Log a meal' CTA is a SOLID primary SupprButton", () => {
    // Button system migration (2026-06-12, ENG-1079): the cold-start card's ONE
    // primary action → `SupprButton` variant="primary" (solid aubergine fill,
    // white label + glyph, pill). Mobile parity: TodayFirstMealEmptyState
    // primary. Supersedes the old aubergine-OUTLINE treatment.
    expect(FIRST_MEAL).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr-button"/);
    expect(FIRST_MEAL).toMatch(/<SupprButton\s+variant="primary"/);
    // Must NOT keep the retired aubergine outline.
    expect(FIRST_MEAL).not.toMatch(OUTLINE);
  });

  it("Meals-section empty 'Log a meal' CTA is a SOLID primary SupprButton", () => {
    // Button system migration (2026-06-12, ENG-1079): the empty-day "Log a meal"
    // CTA → `SupprButton` variant="primary" (solid aubergine fill, white label +
    // glyph, pill), mirroring the cold-start primary. Mobile parity:
    // TodayMealsSection / TodayFirstMealEmptyState primary. Supersedes the old
    // aubergine-OUTLINE treatment.
    expect(MEALS_SECTION).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr-button"/);
    expect(MEALS_SECTION).toMatch(/<SupprButton\s+variant="primary"/);
    // Must NOT keep the retired aubergine outline.
    expect(MEALS_SECTION).not.toMatch(OUTLINE);
  });

  it("Complete-day dialog 'View my progress' is a SOLID primary SupprButton", () => {
    // Button system migration (2026-06-12, ENG-1079): the modal's sole CTA →
    // `SupprButton` variant="primary" (solid aubergine fill, white label, pill).
    // Mobile parity: TodayCompleteDayModal primary. Supersedes the old
    // aubergine-OUTLINE treatment.
    expect(COMPLETE_DAY).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr-button"/);
    expect(COMPLETE_DAY).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,160}>\s*View my progress/);
    // Must NOT keep the retired aubergine outline.
    expect(COMPLETE_DAY).not.toMatch(OUTLINE);
  });

  it("Today 'Complete Day' button (NutritionTracker) is a SOLID primary SupprButton", () => {
    // Button system migration (2026-06-12, ENG-1079): the day's terminal
    // action → `SupprButton` variant="primary" (solid aubergine fill, white
    // label, pill). Mobile parity: TodayCompleteDayButton solid pin.
    expect(TRACKER).toMatch(/<SupprButton\s+variant="primary"\s+label="Complete Day"/);
    // Must NOT regress to the old aubergine outline.
    expect(TRACKER).not.toMatch(/border-\[1\.5px\]\s+border-primary-solid bg-transparent text-primary-solid[\s\S]{0,160}>\s*Complete Day/);
  });

  it("Weekly check-in dialog 'Accept new target' is a SOLID primary; 'Keep current' is a ghost", () => {
    // Button system migration (2026-06-12, ENG-1079): the modal's main CTA →
    // `SupprButton` variant="primary" (solid aubergine fill, white label, pill);
    // the "Keep current" tertiary → variant="ghost" (transparent, plum label).
    // Mobile parity: WeeklyCheckinModal. Supersedes the old aubergine-OUTLINE
    // treatment.
    expect(CHECKIN_DIALOG).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr-button"/);
    expect(CHECKIN_DIALOG).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}>\s*Accept new target/);
    expect(CHECKIN_DIALOG).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,200}>\s*Keep current/);
    // Must NOT keep the retired aubergine outline.
    expect(CHECKIN_DIALOG).not.toMatch(OUTLINE);
  });

  it("Milestone dialog 'Keep going' is a SOLID primary SupprButton", () => {
    // Button system migration (2026-06-12, ENG-1079): the single celebration
    // CTA → `SupprButton` variant="primary" (solid plum fill, white label,
    // pill). Mobile parity: Milestone30DayModal primary.
    expect(MILESTONE).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr-button"/);
    expect(MILESTONE).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,160}>\s*Keep going/);
    // Must NOT keep the retired aubergine outline.
    expect(MILESTONE).not.toMatch(OUTLINE);
  });

  it("Activity-bonus discover CTAs are ghost SupprButtons (secondary nudge)", () => {
    // Button system migration (2026-06-12, ENG-1079): this discover nudge is a
    // SECONDARY action on Today, so both its CTAs → variant="ghost"
    // (transparent, plum label, no border). Mobile parity: both ghost.
    expect(ACTIVITY_BONUS).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr-button"/);
    const ghostHits = ACTIVITY_BONUS.match(/<SupprButton\s+variant="ghost"/g) ?? [];
    expect(ghostHits.length).toBeGreaterThanOrEqual(2);
    // Must NOT keep the retired aubergine outline.
    expect(ACTIVITY_BONUS).not.toMatch(OUTLINE);
  });

  it("Log sheet CTA token/variant anti-drift pins — behaviour covered by loadBearingCtaBehaviour.test.tsx", () => {
    // Button system migration (2026-06-12, ENG-1079): the two sheet commit CTAs
    // → SupprButton variant="primary" (solid plum fill, white label, pill); the
    // secondary Undo + empty-state Browse → variant="ghost" (transparent, plum
    // label). Mobile parity in
    // apps/mobile/tests/unit/todayLaneAubergineOutline.test.ts.
    expect(LOG_SHEET).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr-button"/);
    expect(LOG_SHEET_CONFIRMATION).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,160}label="Done"/);
    expect(LOG_SHEET).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}label="Log it"/);
    expect(LOG_SHEET_CONFIRMATION).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,160}label="Undo"/);
    expect(LOG_SHEET).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,200}label="Browse recipes"/);
    // Must NOT keep the retired aubergine outline or off-white Browse fill.
    expect(LOG_SHEET).not.toMatch(/border-\[1\.5px\]\s+border-primary-solid bg-transparent[\s\S]{0,120}>\s*Done/);
    expect(LOG_SHEET).not.toMatch(/bg-secondary px-5[\s\S]{0,300}>\s*Browse recipes/);
  });

  it("Add-meal dialog 'Add meal' is a SOLID primary SupprButton", () => {
    // Button system migration (2026-06-12, ENG-1079): the dialog's ONE primary
    // action → `SupprButton` variant="primary" (solid plum fill, white label,
    // pill). Mobile parity: quick-add "Add to Today" primary.
    expect(ADD_MEAL).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr-button"/);
    expect(ADD_MEAL).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,80}>\s*Add meal/);
    // Must NOT keep the retired per-instance aubergine outline on the Button.
    expect(ADD_MEAL).not.toMatch(/border-\[1\.5px\]\s+border-primary-solid bg-transparent text-primary-solid/);
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

  it("Log sheet browse tabs: Figma underline active state (ENG-900)", () => {
    expect(LOG_SHEET).toMatch(/border-foreground font-semibold text-foreground/);
  });

  it("Snap shortcut Pro chip = bg-primary/10 + text-primary-solid; shutter glyph = primary-solid", () => {
    expect(SNAP).toMatch(/bg-primary\/10 px-1\.5 py-px text-\[9px\] font-extrabold tracking-wider text-primary-solid/);
    expect(SNAP).toMatch(/text-primary-solid/); // shutter glyph
  });
});
