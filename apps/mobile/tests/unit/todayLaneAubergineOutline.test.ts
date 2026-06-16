/**
 * Today tab + Log sheet lane — Sloe aubergine-outline treatment (2026-06-08).
 *
 * The Sloe component-treatment system (docs/prototypes/sloe-component-
 * treatments.html) rations the accent: the FAB + conversion CTAs (paywall /
 * onboarding) keep a filled aubergine, but every *everyday* primary CTA on
 * the Today surface + Log sheet (Cook this / Log it / Log a meal / Complete
 * Day / Save changes / Accept new target / Keep going / View my progress /
 * Notify me / Browse-recipes) reads as an aubergine OUTLINE — a 1.5px
 * `accent.primarySolid` (scheme-resolved via useAccent — dark inverts) border + `accent.primarySolid` (scheme-resolved via useAccent — dark inverts) label on a
 * transparent fill, NOT a filled slab. Filter pills + segmented controls
 * carry the accent as a SOFT tint, never a solid fill. "Browse" is a
 * SECONDARY off-white fill.
 *
 * This is a source-level structural pin (mirrors
 * `settingsLaneAubergineOutline`). It breaks if any of these CTAs regress
 * to a filled `backgroundColor: accent.primary` slab with a white label, so
 * the reskin can't silently drift. We deliberately assert on
 * `accent.primarySolid` (scheme-resolved via useAccent — dark inverts) (the AA-safe #4E3260 text/border-on-light variant),
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
const PLANNED_MEALS = read("components/today/TodayPlannedMealsCard.tsx");
const IMPORT_SHARED = read("app/import-shared.tsx");
const WHATS_NEW = read("app/whats-new.tsx");

describe("Today lane — aubergine OUTLINE primary CTAs", () => {
  // ── Button system migration (2026-06-12, ENG-1079) ─────────────────
  // The Today-surface CTAs below were migrated from the aubergine-OUTLINE
  // treatment to the `SupprButton` solid-primary / ghost grammar
  // (`docs/decisions/2026-06-12-button-system-solid-primary.md`). These
  // pins now assert the new grammar — each card's ONE primary action is a
  // `<SupprButton variant="primary">` (solid fill, white label, pill, no
  // shadow), secondaries are `variant="ghost"`. Web parity:
  // `tests/unit/todayLaneAubergineOutlineWeb.test.tsx`.
  it("North-star 'Cook this'/'Log it' CTA is a SOLID primary SupprButton", () => {
    // The "what to eat next" moment is the card's one primary action.
    expect(NORTH_STAR).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,160}label=\{ctaLabel\}/);
    // Must NOT regress to the old outline (1.5px primarySolid border) or the
    // even-older 8% subtle fill on the default CTA.
    expect(NORTH_STAR).not.toMatch(/borderColor:\s*accent\.primarySolid/);
    expect(NORTH_STAR).not.toMatch(/backgroundColor:\s*`\$\{accent\.primary\}14`/);
  });

  it("Today 'Complete Day' CTA is a SOLID primary SupprButton", () => {
    // Wave-2 (ENG-1065 F-158): the CTA was extracted from index.tsx to
    // <TodayCompleteDayButton>. Button-system migration: the day's terminal
    // action is the section's one primary → solid SupprButton.
    const COMPLETE_DAY_BUTTON = read("components/today/TodayCompleteDayButton.tsx");
    expect(COMPLETE_DAY_BUTTON).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}label="Complete Day"/);
    expect(COMPLETE_DAY_BUTTON).not.toMatch(/borderColor:\s*accent\.primarySolid/);
    // And the host renders the extracted component (not a re-inlined CTA).
    expect(INDEX).toMatch(/<TodayCompleteDayButton/);
  });

  it("Quick-add submit ('Add to Today') is a SOLID primary; the sibling Search is a GHOST", () => {
    // Migrated `<TodayAddFoodForm>` to SupprButton: primary "Add to Today" +
    // ghost "Search" (replaces the old outline submitBtn + beige Search).
    expect(ADD_FORM).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,160}label="Add to Today"/);
    expect(ADD_FORM).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,200}accessibilityLabel="Search"/);
    // The old host-owned aubergine-outline submitBtn must no longer back this
    // pair (the styles linger only for TodayEditMealModal's Save Changes).
    expect(ADD_FORM).not.toMatch(/styles\.submitBtn/);
  });

  it("First-meal empty state 'Log a meal' CTA is a SOLID primary SupprButton", () => {
    expect(FIRST_MEAL).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}accessibilityLabel="Log a meal"/);
    expect(FIRST_MEAL).not.toMatch(/borderColor:\s*accent\.primarySolid/);
    // The glyph rides on the solid fill → white, not plum.
    expect(FIRST_MEAL).toMatch(/<Plus size=\{16\} color="#fff"/);
  });

  it("Edit-meal 'Save changes' is an outline; Delete stays destructive red", () => {
    expect(EDIT_MEAL).toMatch(/v2\.saveBtn,\s*\{\s*borderColor:\s*accent\.primarySolid/);
    expect(EDIT_MEAL).not.toMatch(/saveBtn:\s*\{[^}]*backgroundColor:\s*accent\.primary,/);
    expect(EDIT_MEAL).toMatch(/Accent\.destructive/); // Delete unchanged
  });

  it("Complete-day modal 'View my progress' is a SOLID primary SupprButton (its sole CTA)", () => {
    // Button system (2026-06-12): the confirmation sheet's one/only action →
    // solid SupprButton primary (white label, full-width pill).
    expect(COMPLETE_DAY).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/);
    expect(COMPLETE_DAY).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}label="View my progress"/);
    // Must NOT regress to the retired aubergine-outline.
    expect(COMPLETE_DAY).not.toMatch(/borderColor:\s*accent\.primarySolid/);
  });

  it("Weekly check-in modal 'Accept' is a SOLID primary + 'Keep current' a GHOST; banner 'OPEN' is a GHOST", () => {
    // Button system (2026-06-12): the modal's main CTA "Accept new target" →
    // solid primary; the "Keep current" tertiary → ghost. The nudge banner's
    // "OPEN" routes to the modal (secondary) → ghost.
    expect(CHECKIN_MODAL).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/);
    expect(CHECKIN_MODAL).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}label="Accept new target"/);
    expect(CHECKIN_MODAL).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,200}label="Keep current"/);
    expect(CHECKIN_BANNER).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/);
    // The OPEN nudge is the banner's only CTA → ghost SupprButton wrapping the
    // compact caps label (a long inline comment + attrs sit between the tag and
    // the label text, so assert tag + label as two pins rather than a tight
    // single-window match).
    expect(CHECKIN_BANNER).toMatch(/<SupprButton\s+variant="ghost"/);
    expect(CHECKIN_BANNER).toMatch(/>\s*OPEN\s*<\/Text>\s*<\/SupprButton>/);
    // Must NOT regress to the retired aubergine-outline on either surface.
    expect(CHECKIN_MODAL).not.toMatch(/borderColor:\s*accent\.primarySolid/);
    expect(CHECKIN_BANNER).not.toMatch(/borderColor:\s*accent\.primarySolid/);
  });

  it("Milestone 'Keep going' is a SOLID-plum SupprButton primary (button system 2026-06-12)", () => {
    // Button system (docs/decisions/2026-06-12-button-system-solid-primary.md):
    // the single celebration CTA migrated from aubergine-outline to the
    // SupprButton primary (solid plum fill, white label, pill, no shadow).
    expect(MILESTONE).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/);
    expect(MILESTONE).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,260}label="Keep going"/);
    // Must NOT regress to the retired aubergine-outline.
    expect(MILESTONE).not.toMatch(/borderColor:\s*accent\.primarySolid[\s\S]{0,400}Keep going/);
  });

  it("Saved-meal portion confirm is a SOLID-plum SupprButton primary (button system 2026-06-12)", () => {
    // The sheet's commit action migrated from aubergine-outline to the
    // SupprButton primary; the flag-gated confirm haptic is preserved.
    expect(SAVED_PORTION).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\.\/ui\/SupprButton"/);
    expect(SAVED_PORTION).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,260}testID="saved-portion-confirm"/);
    expect(SAVED_PORTION).toMatch(/haptic=\{motionEnabled \? "confirm" : "none"\}/);
    // Must NOT regress to the retired aubergine-outline.
    expect(SAVED_PORTION).not.toMatch(/borderColor:\s*(?:Accent|accent)\.primarySolid/);
  });

  it("Activity-bonus 'enable' discover CTA is a GHOST SupprButton (secondary nudge)", () => {
    // Button system (2026-06-12): the discover nudge is a SECONDARY action on
    // Today (Complete Day / "what to eat next" own primary), so its CTA + the
    // "Not now" sibling are ghost SupprButtons (transparent, plum label, no
    // border) — replaces the old aubergine outline.
    expect(ACTIVITY_BONUS).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,200}label=\{ACTIVITY_BUDGET_DISCOVER_CTA\}/);
    expect(ACTIVITY_BONUS).not.toMatch(/borderColor:\s*accent\.primarySolid/);
  });

  it("Post-onboarding push 'Notify me' is an aubergine outline", () => {
    expect(PUSH_EXPLAINER).toMatch(/borderColor:\s*accent\.primarySolid/);
  });

  it("Onboarding nudge banner primary CTA is SOLID aubergine on the flat-white card, outline in the flag-off fallback (ENG-1097)", () => {
    // ENG-1097 — the nudge migrated OUT of the outline lane: on the flat-white
    // card (default-on) the "Try it" CTA is a SOLID aubergine pill (it's the
    // import wedge — a conversion surface). The aubergine OUTLINE survives only
    // in the flag-off legacy tinted-slab path. Both branches are flag-gated on
    // `flatWhite`, so this pins the dual-path rather than the retired outline.
    expect(NUDGE_BANNER).toMatch(/backgroundColor: flatWhite \? accent\.primarySolid : "transparent"/);
    expect(NUDGE_BANNER).toMatch(/borderWidth: flatWhite \? 0 : 1\.5/);
    expect(NUDGE_BANNER).toMatch(/color: flatWhite \? colors\.primaryForeground : accent\.primarySolid/);
  });

  it("Log sheet 'Done' confirmation + barcode 'Log it' are SOLID-plum SupprButton primaries", () => {
    // Button system (2026-06-12): both sheet commit CTAs migrated from
    // aubergine-outline to the SupprButton primary (one per sheet view).
    expect(LOG_SHEET).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/);
    expect(LOG_SHEET).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,400}label="Done"/);
    expect(LOG_SHEET).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,160}label="Log it"/);
    // The Done success haptic + the barcode success-notification both survive.
    // Must NOT regress to the retired aubergine-outline.
    expect(LOG_SHEET).not.toMatch(/borderColor:\s*accent\.primarySolid/);
  });

  it("Log sheet 'Undo' confirmation + 'Browse recipes' empty state are GHOST SupprButtons", () => {
    // Button system (2026-06-12): the secondary Undo + the empty-state Browse
    // are ghost SupprButtons (transparent, plum label), replacing the old quiet
    // text + off-white colors.card fill.
    expect(LOG_SHEET).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,200}label="Undo"/);
    expect(LOG_SHEET).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,260}label="Browse recipes"/);
    // Must NOT keep the retired off-white fill on the Browse CTA.
    expect(LOG_SHEET).not.toMatch(/backgroundColor:\s*colors\.card[\s\S]{0,400}>Browse recipes</);
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
    expect(EDIT_MEAL).toMatch(/backgroundColor:\s*editSlot === s\s*\?\s*accent\.primarySoft/);
    expect(EDIT_MEAL).toMatch(/color:\s*editSlot === s\s*\?\s*accent\.primarySolid/);
  });

  it("Date-header day/week segmented control: active = primarySoft lift + primarySolid glyph", () => {
    // Accepts both static Accent.* and hook accent.* patterns (migrated 2026-06-09).
    expect(DATE_HEADER).toMatch(/viewMode === "day"\s*\?\s*(?:Accent|accent)\.primarySoft/);
    expect(DATE_HEADER).toMatch(/viewMode === "week"\s*\?\s*(?:Accent|accent)\.primarySoft/);
    expect(DATE_HEADER).toMatch(/color=\{viewMode === "day"\s*\?\s*(?:Accent|accent)\.primarySolid/);
  });

  it("Log sheet browse tabs: Figma underline active state (ENG-900)", () => {
    expect(LOG_SHEET).toMatch(/fontWeight:\s*active\s*\?\s*"600"\s*:\s*"400"/);
    expect(LOG_SHEET).toMatch(/color:\s*active\s*\?\s*colors\.text\s*:\s*colors\.textTertiary/);
  });

  it("Snap shortcut Pro chip = primarySoft + primarySolid; shutter is a soft-tint container", () => {
    expect(SNAP).toMatch(/backgroundColor:\s*accent\.primarySoft/);
    expect(SNAP).toMatch(/color:\s*accent\.primarySolid/);
    // The shutter must NOT be a second solid-aubergine filled circle.
    expect(SNAP).not.toMatch(/borderRadius:\s*22,\s*\n\s*backgroundColor:\s*accent\.primary,/);
  });

  it("Eat-again nudge is a soft-tint card with a GHOST 'Log it' CTA", () => {
    // Button system (2026-06-12): the eat-again prompt is a NUDGE banner (same
    // category as the activity-bonus discover nudge) — the north-star hero owns
    // the primary "Log it" moment, so this secondary nudge CTA is a ghost
    // SupprButton (transparent, plum label). The soft-tint card wash stays.
    expect(EAT_AGAIN).toMatch(/import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/);
    expect(EAT_AGAIN).toMatch(/accent\.primarySoft/); // card wash
    // Ghost CTA wrapping the "Log it" caption label (an inline comment + attrs
    // sit between the tag and the label, so assert tag + label as two pins).
    expect(EAT_AGAIN).toMatch(/<SupprButton\s+variant="ghost"/);
    expect(EAT_AGAIN).toMatch(/>Log it<\/Text>\s*<\/SupprButton>/);
    // Must NOT regress to the retired aubergine-outline.
    expect(EAT_AGAIN).not.toMatch(/borderColor:\s*accent\.primarySolid/);
  });
});

describe("CTA weight map — Spec 2 outline/pill conversions (2026-06-09)", () => {
  it("Planned-meals 'Log today' is a compact outline pill, not bare caps text", () => {
    // 1.5px primarySolid border + full radius + caps Type.label label — the
    // per-row primary reads as an accent line, not bare text.
    expect(PLANNED_MEALS).toMatch(/borderColor:\s*accent\.primarySolid/);
    expect(PLANNED_MEALS).toMatch(/borderRadius:\s*Radius\.full/);
    expect(PLANNED_MEALS).toMatch(/\.\.\.Type\.label,\s*color:\s*accent\.primarySolid\s*\}\}>Log today</);
    // Must NOT regress to the old padded bare-text affordance.
    expect(PLANNED_MEALS).not.toMatch(/style=\{\{\s*paddingHorizontal:\s*8,\s*paddingVertical:\s*Spacing\.dense\s*\}\}/);
  });

  it("import-shared 'Import' (both idle paths) is a SOLID primary SupprButton", () => {
    // Sloe button-system canon (2026-06-12): the import action is the screen's
    // commit, so it's the solid aubergine SupprButton variant="primary".
    expect(IMPORT_SHARED).toMatch(/testID="import-shared-import"[\s\S]{0,200}label="Import"/);
    expect(IMPORT_SHARED).toMatch(/testID="import-shared-import-legacy"[\s\S]{0,200}label="Import"/);
    // Both idle Import buttons are the primary variant (redesign + legacy).
    expect(IMPORT_SHARED).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}testID="import-shared-import"/);
    expect(IMPORT_SHARED).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}testID="import-shared-import-legacy"/);
    // The retired aubergine-outline style must be gone.
    expect(IMPORT_SHARED).not.toMatch(/outlineImportBtn/);
  });

  it("whats-new 'Done' is a SupprButton ghost (2026-06-12 canon), not an outline pill", () => {
    // 2026-06-12 button-system canon: the header dismiss pill is a dismiss, not
    // a commit → ghost (transparent, no border, plum label).
    expect(WHATS_NEW).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}testID="whats-new-done"/,
    );
    expect(WHATS_NEW).toMatch(/<SupprButton[\s\S]{0,300}label="Done"/);
    // The retired outline must be gone — no primarySolid border on the pill.
    expect(WHATS_NEW).not.toMatch(
      /testID="whats-new-done"[\s\S]{0,300}borderColor:\s*accent\.primarySolid/,
    );
  });
});
