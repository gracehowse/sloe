/**
 * Settings / Profile / Targets / Household / Goal-pace lane — Sloe
 * aubergine-outline treatment (2026-06-08).
 *
 * The Sloe component-treatment system (docs/prototypes/sloe-component-
 * treatments.html) rations the accent: the FAB + conversion CTAs keep a
 * filled aubergine, but every *everyday* primary CTA on a settings-style
 * surface (Save / Recalculate / Apply / Done / goal-pace Save+Confirm /
 * household Save / Health connect) reads as an aubergine OUTLINE — a 1.5px
 * `accent.primarySolid` (scheme-resolved via useAccent — dark inverts) border + `accent.primarySolid` (scheme-resolved via useAccent — dark inverts) label on a
 * transparent/white fill, NOT a filled slab.
 *
 * This is a source-level structural pin (mirrors `settingsSignOutNeutralColor`
 * / `settingsYourNameParity`). It breaks if any of these CTAs regress back to
 * a filled `backgroundColor: accent.primary` slab with a white label, so the
 * reskin can't silently drift. We deliberately assert on `accent.primarySolid` (scheme-resolved via useAccent — dark inverts)
 * (the AA-safe #4E3260 text/border-on-light variant), not the `accent.primary`
 * fill hue.
 *
 * 2026-06-12 (Sloe button-system canon,
 * `docs/decisions/2026-06-12-button-system-solid-primary.md`): the SETTINGS
 * CTAs (name Save, promo Apply, Pro-banner Manage, reset Refresh-my-plan, the
 * target-picker Save/Done) migrated to the SupprButton primary/ghost grammar
 * — see the cases below. Across the ENG-1080 button-cohesion waves (Wave D
 * Settings, Wave E goal-pace + household, Wave F Targets + Profile + Health),
 * EVERY CTA on these surfaces has now migrated to the SupprButton primary/ghost
 * grammar: name Save / Pro-banner Manage / invite Copy = ghost; promo Apply /
 * Refresh-my-plan = primary; goal-pace editor Save + retune Confirm = primary
 * with Cancel = ghost; household Save = primary, solo Invite = ghost; Targets
 * Recalculate = ghost; Profile Save Targets = primary, Cancel = ghost; Health
 * Connect/Sync = primary, both error-recovery actions (Try again + Open iOS
 * Settings) = ghost (the error banner co-renders above the Connect/Sync primary,
 * so it must not add a second solid). No aubergine OUTLINE remains on this lane;
 * each case below pins the new grammar + an anti-regression negative.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const TARGETS = read("app/targets.tsx");
const PROFILE = read("app/profile.tsx");
const HOUSEHOLD = read("app/household-settings.tsx");
const HEALTH = read("app/health-sync.tsx");
const GOAL_CONTROLS = read("components/recap/GoalPaceControls.tsx");
const GOAL_RETUNE = read("components/recap/GoalPaceRetuneSheet.tsx");
const BUNDLE = read("components/settings/SettingsBundleContent.tsx");

describe("Settings lane — aubergine OUTLINE primary CTAs", () => {
  it("Targets Recalculate is a SupprButton ghost (2026-06-12 canon), not an outline", () => {
    // 2026-06-12 button-system canon: the everyday aubergine OUTLINE retired.
    // Recalculate is the secondary action on the read-out targets screen → ghost.
    expect(TARGETS).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}testID="targets-recalculate"/,
    );
    // The retired outline must be gone — no primarySolid border on the control.
    expect(TARGETS).not.toMatch(
      /testID="targets-recalculate"[\s\S]{0,400}borderColor:\s*accent\.primarySolid/,
    );
  });

  it("Profile Save Targets is a SupprButton primary, Cancel sibling is ghost (2026-06-12 canon)", () => {
    // 2026-06-12 button-system canon: Save Targets is the screen's one commit →
    // primary; the Cancel sibling (the dismiss/recovery) → ghost.
    expect(PROFILE).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,300}label="Save Targets"/,
    );
    expect(PROFILE).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}label="Cancel"/,
    );
    // The retired outline styles must be gone.
    expect(PROFILE).not.toMatch(/saveBtn:\s*\{/);
    expect(PROFILE).not.toMatch(/saveBtnText:\s*\{/);
    expect(PROFILE).not.toMatch(/cancelBtn:\s*\{/);
  });

  it("Profile selected dietary pill uses the aubergine soft tint (not sage)", () => {
    expect(PROFILE).toMatch(/dietaryChipActive:\s*\{[\s\S]{0,140}backgroundColor:\s*accent\.primarySoft/);
    expect(PROFILE).not.toMatch(/dietaryChipActive:\s*\{[\s\S]{0,140}Accent\.success/);
  });

  it("Household Save changes is a SupprButton primary; solo Invite is a SupprButton ghost (2026-06-13 canon)", () => {
    // 2026-06-13 button-system canon (ENG-1080 household wave): the household
    // CTAs migrated off the aubergine OUTLINE / off-white slab onto the
    // SupprButton primary/ghost grammar. Save = the footer's one commit
    // action → primary; solo Invite = secondary → ghost. Neither carries the
    // retired primarySolid border or colors.card fill.
    expect(HOUSEHOLD).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,400}testID="household-settings-save"/,
    );
    expect(HOUSEHOLD).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,400}testID="household-settings-solo-invite"/,
    );
    expect(HOUSEHOLD).not.toMatch(
      /testID="household-settings-save"[\s\S]{0,400}borderColor:\s*accent\.primarySolid/,
    );
    expect(HOUSEHOLD).not.toMatch(
      /testID="household-settings-solo-invite"[\s\S]{0,400}backgroundColor:\s*colors\.card/,
    );
  });

  it("Health connect / sync / recovery CTAs are SupprButtons (2026-06-12 canon)", () => {
    // 2026-06-12 button-system canon: the aubergine OUTLINE retired here too.
    // Connect Health Data + Sync Now (one logical primary across two render
    // states) → SupprButton primary; the error banner co-renders ABOVE the
    // Connect/Sync primary (it's a sibling, not a replacement), so BOTH error
    // recovery actions are ghost — "Try again" + "Open iOS Settings" — keeping
    // Connect/Sync the screen's one solid primary (Wave F review, 2026-06-13).
    expect(HEALTH).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}label="Connect Health Data"/,
    );
    expect(HEALTH).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}label="Sync Now"/,
    );
    expect(HEALTH).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,260}testID="health-sync-error-retry"/,
    );
    expect(HEALTH).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,260}testID="health-sync-error-open-settings"/,
    );
    // The retired outline style must be gone.
    expect(HEALTH).not.toMatch(/btnOutline:\s*\{/);
    expect(HEALTH).not.toMatch(/btnOutlineText:\s*\{/);
  });

  it("Goal-pace Save (editor) + Confirm (retune) are SupprButton primaries; Cancel siblings are ghosts (2026-06-12 canon)", () => {
    // 2026-06-12 button-system canon: each sheet's ONE commit action is a
    // solid-aubergine SupprButton primary; the Cancel sibling is a ghost.
    // The retired aubergine OUTLINE (primarySolid border) is gone from both.
    expect(GOAL_CONTROLS).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,300}testID="goal-pace-editor-save"/,
    );
    expect(GOAL_CONTROLS).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}testID="goal-pace-editor-cancel"/,
    );
    expect(GOAL_CONTROLS).not.toMatch(
      /testID="goal-pace-editor-save"[\s\S]{0,300}borderColor:\s*accent\.primarySolid/,
    );
    expect(GOAL_RETUNE).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,300}testID="goal-pace-retune-confirm"/,
    );
    expect(GOAL_RETUNE).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}testID="goal-pace-retune-cancel"/,
    );
    expect(GOAL_RETUNE).not.toMatch(
      /testID="goal-pace-retune-confirm"[\s\S]{0,300}borderColor:\s*accent\.primarySolid/,
    );
  });

  it("Settings name Save is a SupprButton ghost, promo Apply is a SupprButton primary (2026-06-12 canon)", () => {
    // 2026-06-12 button-system canon: the everyday aubergine OUTLINE retired.
    // Name Save → ghost (inline secondary); promo Apply → primary (the promo
    // card's own action). Neither carries the retired primarySolid border.
    expect(BUNDLE).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}testID="settings-bundle-name-save"/,
    );
    expect(BUNDLE).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,300}testID="settings-bundle-promo-code-apply"/,
    );
    expect(BUNDLE).not.toMatch(
      /testID="settings-bundle-name-save"[\s\S]{0,400}borderColor:\s*(?:Accent|accent)\.primarySolid/,
    );
    expect(BUNDLE).not.toMatch(
      /testID="settings-bundle-promo-code-apply"[\s\S]{0,400}borderColor:\s*(?:Accent|accent)\.primarySolid/,
    );
  });

  it("Sloe Pro banner: unconditional white slab (ENG-1081, card_cohesion_white_v1 collapsed ENG-1356), never a hardcoded clay rgba", () => {
    // ENG-1081 (Grace 2026-06-13: "flat white for now"): card-fill cohesion —
    // the banner is a flat WHITE slab. Was flag-gated behind
    // card_cohesion_white_v1 (aubergine tint in the else); the always-on flag
    // was collapsed in ENG-1356 — only the white-slab path remains.
    expect(BUNDLE).toMatch(/testID="settings-sloe-pro-banner"/);
    expect(BUNDLE).not.toMatch(/card_cohesion_white_v1/);
    expect(BUNDLE).not.toMatch(/cohesionWhite/);
    expect(BUNDLE).toMatch(
      /testID="settings-sloe-pro-banner"[\s\S]{0,700}backgroundColor:\s*statTileElevation\.liftBg \?\? colors\.card/,
    );
    // Off-token clay rgba never returns either way.
    expect(BUNDLE).not.toContain("rgba(200, 121, 78, 0.16)");
  });

  it("the rail segmented control active label is the aubergine solid", () => {
    // SegmentedRow active label uses scheme-resolved primarySolid on the white lift.
    // Accepts both static Accent.* and hook accent.* patterns (migrated 2026-06-09).
    expect(BUNDLE).toMatch(
      /color:\s*active\s*\?\s*(?:Accent|accent)\.primarySolid\s*:\s*colors\.textSecondary/,
    );
  });
});
