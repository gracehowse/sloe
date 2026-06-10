/**
 * Today tab + Log sheet lane — Sloe aubergine-outline treatment (2026-06-08).
 *
 * The Sloe component-treatment system (docs/prototypes/sloe-component-
 * treatments.html) rations the accent: the FAB + conversion CTAs (paywall /
 * onboarding) keep a filled aubergine, but every *everyday* primary CTA on
 * the Today surface + Log sheet (Cook this / Log it / Log a meal / Complete
 * Day / Save changes / Accept new target / Keep going / View my progress /
 * Notify me / Browse-recipes) reads as an aubergine OUTLINE — a 1.5px
 * `Accent.primarySolid` border + `Accent.primarySolid` label on a
 * transparent fill, NOT a filled slab. Filter pills + segmented controls
 * carry the accent as a SOFT tint, never a solid fill. "Browse" is a
 * SECONDARY off-white fill.
 *
 * This is a source-level structural pin (mirrors
 * `settingsLaneAubergineOutline`). It breaks if any of these CTAs regress
 * to a filled `backgroundColor: accent.primary` slab with a white label, so
 * the reskin can't silently drift. We deliberately assert on
 * `Accent.primarySolid` (the AA-safe #4E3260 text/border-on-light variant),
 * not the `accent.primary` fill hue.
 *
 * Web parity for these surfaces is pinned in
 * `tests/unit/todayLaneAubergineOutlineWeb.test.tsx`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const INDEX = read("app/(tabs)/index.tsx");
const NORTH_STAR = read("components/today/NorthStarBlock.tsx");
const LOG_SHEET = read("components/today/LogSheet.tsx");
const QUICK_ADD = read("components/QuickAddPanel.tsx");
const EAT_AGAIN = read("components/today/TodayEatAgainBanner.tsx");
const FIRST_MEAL = read("components/today/TodayFirstMealEmptyState.tsx");
const ADD_FORM = read("components/today/TodayAddFoodForm.tsx");
const COMPLETE_DAY = read("components/today/TodayCompleteDayModal.tsx");
const EDIT_MEAL = read("components/today/TodayEditMealModal.tsx");
const DATE_HEADER = read("components/today/TodayDateHeader.tsx");
const SNAP = read("components/today/TodaySnapShortcut.tsx");
const CHECKIN_BANNER = read("components/today/WeeklyCheckinBanner.tsx");
const CHECKIN_MODAL = read("components/today/WeeklyCheckinModal.tsx");
const MILESTONE = read("components/today/Milestone30DayModal.tsx");
const SAVED_PORTION = read("components/today/SavedMealPortionSheet.tsx");
const ACTIVITY_BONUS = read("components/today/TodayActivityBonusCard.tsx");
const PUSH_EXPLAINER = read("components/today/PostOnboardingPushExplainer.tsx");
const NUDGE_BANNER = read("components/today/onboarding-nudges/OnboardingNudgeBanner.tsx");

describe("Today lane — aubergine OUTLINE primary CTAs", () => {
  it("North-star 'Cook this'/'Log it' CTA is an outline, not the old 8% tint fill", () => {
    expect(NORTH_STAR).toMatch(/borderColor:\s*accent\.primarySolid/);
    // The CTA label renders in primarySolid (style array → JSX expr).
    expect(NORTH_STAR).toMatch(/color:\s*accent\.primarySolid\s*\}\]\}>\s*\{ctaLabel\}/);
    // Must NOT reuse the old subtle-fill (8% accent) on the default CTA.
    expect(NORTH_STAR).not.toMatch(/backgroundColor:\s*`\$\{accent\.primary\}14`/);
  });

  it("Today 'Complete Day' CTA is an aubergine outline", () => {
    expect(INDEX).toMatch(/borderColor:\s*accent\.primarySolid[\s\S]{0,200}>Complete Day</);
    expect(INDEX).not.toMatch(/backgroundColor:\s*accent\.primary,\s*\n\s*alignItems:\s*"center",\s*\n\s*\}\)?\s*\n\s*\}?\s*>\s*\n\s*<Text[^>]*color:\s*"#fff"[^>]*>Complete Day/);
  });

  it("Quick-add submit ('Add to Today') is an outline; the sibling Search is an off-white secondary", () => {
    // The host-owned submitBtn style carries the outline; Search overrides to colors.card.
    expect(INDEX).toMatch(/submitBtn:\s*\{[\s\S]{0,200}borderColor:\s*accent\.primarySolid/);
    expect(INDEX).toMatch(/submitBtnText:\s*\{\s*color:\s*accent\.primarySolid/);
    expect(INDEX).not.toMatch(/submitBtn:\s*\{\s*\n\s*backgroundColor:\s*accent\.primary,/);
    expect(ADD_FORM).toMatch(/backgroundColor:\s*colors\.card/);
  });

  it("First-meal empty state 'Log a meal' CTA is an aubergine outline", () => {
    expect(FIRST_MEAL).toMatch(/borderColor:\s*accent\.primarySolid/);
    expect(FIRST_MEAL).toMatch(/<Plus size=\{16\} color=\{accent\.primarySolid\}/);
  });

  it("Edit-meal 'Save changes' is an outline; Delete stays destructive red", () => {
    expect(EDIT_MEAL).toMatch(/saveBtn:\s*\{[\s\S]{0,200}borderColor:\s*Accent\.primarySolid/);
    expect(EDIT_MEAL).not.toMatch(/saveBtn:\s*\{[^}]*backgroundColor:\s*Accent\.primary,/);
    expect(EDIT_MEAL).toMatch(/Accent\.destructive/); // Delete unchanged
  });

  it("Complete-day modal 'View my progress' is an aubergine outline", () => {
    expect(COMPLETE_DAY).toMatch(/borderColor:\s*Accent\.primarySolid[\s\S]{0,200}>View my progress</);
  });

  it("Weekly check-in modal 'Accept new target' is an outline; banner 'OPEN' is an outline", () => {
    expect(CHECKIN_MODAL).toMatch(/borderColor:\s*Accent\.primarySolid[\s\S]{0,400}Accept new target/);
    expect(CHECKIN_BANNER).toMatch(/borderColor:\s*accent\.primarySolid[\s\S]{0,400}OPEN/);
  });

  it("Milestone 'Keep going' is an aubergine outline (not a filled celebration slab)", () => {
    expect(MILESTONE).toMatch(/borderColor:\s*Accent\.primarySolid[\s\S]{0,400}Keep going/);
  });

  it("Saved-meal portion confirm is an aubergine outline", () => {
    // borderColor is injected inline via the hook-resolved accent; the static
    // confirmBtn sheet entry handles the non-colour shape (border width, radius, padding).
    expect(SAVED_PORTION).toMatch(/borderColor:\s*(?:Accent|accent)\.primarySolid/);
  });

  it("Activity-bonus 'enable' discover CTA is an aubergine outline", () => {
    expect(ACTIVITY_BONUS).toMatch(/borderColor:\s*accent\.primarySolid/);
  });

  it("Post-onboarding push 'Notify me' is an aubergine outline", () => {
    expect(PUSH_EXPLAINER).toMatch(/borderColor:\s*accent\.primarySolid/);
  });

  it("Onboarding nudge banner primary CTA is an aubergine outline", () => {
    expect(NUDGE_BANNER).toMatch(/borderColor:\s*accent\.primarySolid/);
    expect(NUDGE_BANNER).toMatch(/color:\s*accent\.primarySolid[\s\S]{0,240}\{nudge\.primaryLabel\}/);
    // The CTA must NOT regress to a filled accent slab with a white label.
    expect(NUDGE_BANNER).not.toMatch(/backgroundColor:\s*accent\.primary,\s*\n\s*alignItems[\s\S]{0,200}color:\s*"#ffffff"/);
  });

  it("Log sheet 'Done' confirmation + barcode 'Log it' are aubergine outlines", () => {
    expect(LOG_SHEET).toMatch(/borderColor:\s*accent\.primarySolid/);
    // Two distinct outline CTAs (Done + barcode Log it) reference primarySolid.
    const matches = LOG_SHEET.match(/borderColor:\s*accent\.primarySolid/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("Log sheet 'Browse recipes' empty state is an off-white SECONDARY, not a filled accent", () => {
    // The Browse-recipes CTA fills with colors.card and labels in colors.text.
    expect(LOG_SHEET).toMatch(/backgroundColor:\s*colors\.card[\s\S]{0,400}>Browse recipes</);
    expect(LOG_SHEET).toMatch(/color:\s*colors\.text\s*\}\]\}>Browse recipes</);
    // Must NOT fill the Browse CTA with the accent.
    expect(LOG_SHEET).not.toMatch(/backgroundColor:\s*accent\.primary,[\s\S]{0,120}>Browse recipes</);
  });
});

describe("Today lane — filter pills + segmented controls use the SOFT tint", () => {
  it("Quick-add tab pills: selected = primarySoft + primarySolid label (not a solid fill)", () => {
    expect(QUICK_ADD).toMatch(/backgroundColor:\s*active\s*\?\s*accent\.primarySoft\s*:\s*colors\.card/);
    expect(QUICK_ADD).toMatch(/color:\s*active\s*\?\s*accent\.primarySolid\s*:\s*colors\.textSecondary/);
    expect(QUICK_ADD).not.toMatch(/backgroundColor:\s*active\s*\?\s*accent\.primary\s*:/);
  });

  it("Quick-add inline form slot pills: selected = primarySoft + primarySolid label", () => {
    expect(ADD_FORM).toMatch(/backgroundColor:\s*activeMealSlot === s\s*\?\s*accent\.primarySoft/);
    expect(ADD_FORM).toMatch(/color:\s*activeMealSlot === s\s*\?\s*accent\.primarySolid/);
  });

  it("Edit-meal legacy slot pills: selected = primarySoft + primarySolid label", () => {
    expect(EDIT_MEAL).toMatch(/backgroundColor:\s*editSlot === s\s*\?\s*Accent\.primarySoft/);
    expect(EDIT_MEAL).toMatch(/color:\s*editSlot === s\s*\?\s*Accent\.primarySolid/);
  });

  it("Date-header day/week segmented control: active = primarySoft lift + primarySolid glyph", () => {
    // Accepts both static Accent.* and hook accent.* patterns (migrated 2026-06-09).
    expect(DATE_HEADER).toMatch(/viewMode === "day"\s*\?\s*(?:Accent|accent)\.primarySoft/);
    expect(DATE_HEADER).toMatch(/viewMode === "week"\s*\?\s*(?:Accent|accent)\.primarySoft/);
    expect(DATE_HEADER).toMatch(/color=\{viewMode === "day"\s*\?\s*(?:Accent|accent)\.primarySolid/);
  });

  it("Log sheet browse segmented control: active label = primarySolid", () => {
    expect(LOG_SHEET).toMatch(/color:\s*active\s*\?\s*accent\.primarySolid\s*:\s*colors\.textSecondary/);
  });

  it("Snap shortcut Pro chip = primarySoft + primarySolid; shutter is a soft-tint container", () => {
    expect(SNAP).toMatch(/backgroundColor:\s*accent\.primarySoft/);
    expect(SNAP).toMatch(/color:\s*accent\.primarySolid/);
    // The shutter must NOT be a second solid-aubergine filled circle.
    expect(SNAP).not.toMatch(/borderRadius:\s*22,\s*\n\s*backgroundColor:\s*accent\.primary,/);
  });

  it("Eat-again nudge is a soft-tint card with an outline 'Log it' CTA", () => {
    expect(EAT_AGAIN).toMatch(/Accent\.primarySoft/); // card wash
    expect(EAT_AGAIN).toMatch(/borderColor:\s*Accent\.primarySolid/); // CTA outline
  });
});
