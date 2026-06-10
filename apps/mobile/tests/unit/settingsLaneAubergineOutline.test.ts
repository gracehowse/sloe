/**
 * Settings / Profile / Targets / Household / Goal-pace lane — Sloe
 * aubergine-outline treatment (2026-06-08).
 *
 * The Sloe component-treatment system (docs/prototypes/sloe-component-
 * treatments.html) rations the accent: the FAB + conversion CTAs keep a
 * filled aubergine, but every *everyday* primary CTA on a settings-style
 * surface (Save / Recalculate / Apply / Done / goal-pace Save+Confirm /
 * household Save / Health connect) reads as an aubergine OUTLINE — a 1.5px
 * `Accent.primarySolid` border + `Accent.primarySolid` label on a
 * transparent/white fill, NOT a filled slab.
 *
 * This is a source-level structural pin (mirrors `settingsSignOutNeutralColor`
 * / `settingsYourNameParity`). It breaks if any of these CTAs regress back to
 * a filled `backgroundColor: accent.primary` slab with a white label, so the
 * reskin can't silently drift. We deliberately assert on `Accent.primarySolid`
 * (the AA-safe #4E3260 text/border-on-light variant), not the `accent.primary`
 * fill hue.
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
  it("Targets Recalculate is an outline (primarySolid border + label), not a filled slab", () => {
    // The recalculate Pressable references primarySolid for its border, and
    // the label is rendered in primarySolid (text colour).
    expect(TARGETS).toMatch(/testID="targets-recalculate"[\s\S]{0,400}borderColor:\s*Accent\.primarySolid/);
    expect(TARGETS).toMatch(/color:\s*Accent\.primarySolid\s*\}\}>\s*\{recalculating/);
    // It must NOT fill the recalculate control with the accent slab.
    expect(TARGETS).not.toMatch(/testID="targets-recalculate"[\s\S]{0,400}backgroundColor:\s*accent\.primary\b/);
  });

  it("Profile Save Targets is an aubergine outline", () => {
    // saveBtn carries a transparent fill + primarySolid border + label.
    expect(PROFILE).toMatch(/saveBtn:\s*\{[\s\S]{0,200}borderColor:\s*Accent\.primarySolid/);
    expect(PROFILE).toMatch(/saveBtnText:\s*\{\s*color:\s*Accent\.primarySolid/);
    expect(PROFILE).not.toMatch(/saveBtn:\s*\{[\s\S]{0,120}backgroundColor:\s*accent\.primary/);
  });

  it("Profile selected dietary pill uses the aubergine soft tint (not sage)", () => {
    expect(PROFILE).toMatch(/dietaryChipActive:\s*\{[\s\S]{0,140}backgroundColor:\s*Accent\.primarySoft/);
    expect(PROFILE).not.toMatch(/dietaryChipActive:\s*\{[\s\S]{0,140}Accent\.success/);
  });

  it("Household Save changes is an outline; solo Invite is an off-white secondary", () => {
    expect(HOUSEHOLD).toMatch(/testID="household-settings-save"[\s\S]{0,500}borderColor:\s*Accent\.primarySolid/);
    // Solo-empty Invite reads as an off-white (colors.card) secondary, not a filled accent.
    expect(HOUSEHOLD).toMatch(/testID="household-settings-solo-invite"[\s\S]{0,500}backgroundColor:\s*colors\.card/);
  });

  it("Health connect / sync CTAs are aubergine outlines", () => {
    // The shared outline style carries primarySolid border + label.
    expect(HEALTH).toMatch(/btnOutline:\s*\{[\s\S]{0,200}borderColor:\s*Accent\.primarySolid/);
    expect(HEALTH).toMatch(/btnOutlineText:\s*\{[^}]*color:\s*Accent\.primarySolid/);
  });

  it("Goal-pace Save (editor) + Confirm (retune) are aubergine outlines", () => {
    expect(GOAL_CONTROLS).toMatch(/testID="goal-pace-editor-save"[\s\S]{0,260}borderColor:\s*Accent\.primarySolid/);
    expect(GOAL_CONTROLS).not.toMatch(/testID="goal-pace-editor-save"[\s\S]{0,200}backgroundColor:\s*accent\.primary/);
    expect(GOAL_RETUNE).toMatch(/testID="goal-pace-retune-confirm"[\s\S]{0,300}borderColor:\s*Accent\.primarySolid/);
  });

  it("Settings name Save + promo Apply are aubergine outlines", () => {
    // Accepts both static Accent.* and hook accent.* patterns (migrated 2026-06-09).
    expect(BUNDLE).toMatch(
      /testID="settings-bundle-name-save"[\s\S]{0,600}borderColor:\s*(?:Accent|accent)\.primarySolid/,
    );
    expect(BUNDLE).toMatch(
      /testID="settings-bundle-promo-code-apply"[\s\S]{0,600}borderColor:\s*(?:Accent|accent)\.primarySolid/,
    );
  });

  it("Sloe Pro banner uses the aubergine soft tint, not the hardcoded clay rgba", () => {
    // Accepts both static Accent.* and hook accent.* patterns (migrated 2026-06-09).
    expect(BUNDLE).toMatch(
      /testID="settings-sloe-pro-banner"[\s\S]{0,900}backgroundColor:\s*(?:Accent|accent)\.primarySoft/,
    );
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
