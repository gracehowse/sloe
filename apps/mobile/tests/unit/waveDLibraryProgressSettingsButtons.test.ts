/**
 * Wave D (MOBILE) — Library + Progress + Settings CTA migration to SupprButton
 * (button-system canon, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * The 2026-06-12 canon retired the everyday aubergine-OUTLINE primary in
 * favour of two SupprButton variants:
 *   - PRIMARY (a surface's ONE main action) → `variant="primary"`: SOLID
 *     aubergine fill, white label, full pill, no border.
 *   - GHOST (secondaries / inline Save / inline card chips / decorative
 *     pills) → `variant="ghost"`: transparent, plum label, no border.
 *
 * Wave D is the Library + Progress + Settings sweep. These are source-level
 * structural pins (mirror `settingsLaneAubergineOutline`) — they break if a
 * Wave-D CTA regresses to the retired `accent.primarySolid` border outline or
 * a filled `accent.primary` slab so the migration can't silently drift.
 *
 * Web parity for the same CTAs is pinned in
 * `tests/unit/waveDLibraryProgressSettingsButtonsWeb.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const LIBRARY = read("app/(tabs)/library.tsx");
const PROGRESS = read("app/(tabs)/progress.tsx");
const BUNDLE = read("components/settings/SettingsBundleContent.tsx");

describe("Wave D (mobile) — Library CTAs", () => {
  it("imports the shared mobile SupprButton primitive", () => {
    expect(LIBRARY).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("per-card 'Go public' is a GHOST (transparent, no border, plum label)", () => {
    expect(LIBRARY).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,120}label="Go public"/,
    );
  });

  it("empty-library 'Import a recipe' is a SOLID primary (web parity)", () => {
    expect(LIBRARY).toMatch(
      /<SupprButton\s+variant="primary"\s+label="Import a recipe"/,
    );
  });

  it("the Go-public layout override drops the retired aubergine outline border", () => {
    // `goPublicBtn` is layout-only now (padding trim); the border/colour grammar
    // moved into SupprButton variant="ghost".
    expect(LIBRARY).not.toMatch(/goPublicBtn:\s*\{[\s\S]{0,160}borderColor:\s*accent\.primarySolid/);
    expect(LIBRARY).not.toMatch(/goPublicBtn:\s*\{[\s\S]{0,160}borderWidth:\s*1\.5/);
  });
});

describe("Wave D (mobile) — Progress CTAs", () => {
  it("imports the shared mobile SupprButton primitive", () => {
    expect(PROGRESS).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("'Log weight' is a QUIET ghost (v3 prototype — the chart stays the hero)", () => {
    // ENG-1247: conformed from a filled primary to the app's `ghost` quiet
    // button (the prototype's calm `btn--secondary` Log-weight action).
    expect(PROGRESS).toMatch(
      /<SupprButton\s+variant="ghost"\s+testID="progress-log-weight"[\s\S]{0,160}label="＋  Log weight"/,
    );
  });

  it("the migrated 'Log weight' CTA carries no retired aubergine outline", () => {
    expect(PROGRESS).not.toMatch(
      /testID="progress-log-weight"[\s\S]{0,300}borderColor:\s*(?:accent|Accent)\.(?:accentSolid|primarySolid)/,
    );
  });
});

describe("Wave D (mobile) — SettingsBundleContent CTAs", () => {
  it("imports the shared mobile SupprButton primitive", () => {
    expect(BUNDLE).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("the name Save is a GHOST", () => {
    expect(BUNDLE).toMatch(
      /<SupprButton\s+variant="ghost"\s+testID="settings-bundle-name-save"[\s\S]{0,200}label="Save"/,
    );
  });

  it("the inline caffeine + alcohol Saves are GHOSTs", () => {
    expect(BUNDLE).toMatch(
      /<SupprButton\s+variant="ghost"\s+accessibilityLabel="Save caffeine limit"\s+label="Save"/,
    );
    expect(BUNDLE).toMatch(
      /<SupprButton\s+variant="ghost"\s+accessibilityLabel="Save alcohol limit"\s+label="Save"/,
    );
  });

  it("the Sloe Pro banner Manage is a GHOST pill (decorative — plum label, no border)", () => {
    // The whole banner row is the Pressable, so Manage stays a decorative pill
    // carrying the ghost grammar by hand (transparent, no border, plum label).
    expect(BUNDLE).toMatch(
      /Manage — GHOST treatment[\s\S]{0,600}color:\s*accent\.primarySolid\s*\}\}>\s*Manage/,
    );
    expect(BUNDLE).not.toMatch(
      /Manage — GHOST treatment[\s\S]{0,600}borderWidth:\s*1\.5[\s\S]{0,120}Manage/,
    );
  });

  it("the promo-code Apply is a SOLID primary (the promo card's own action)", () => {
    expect(BUNDLE).toMatch(
      /<SupprButton\s+variant="primary"\s+testID="settings-bundle-promo-code-apply"[\s\S]{0,200}label="Apply"/,
    );
  });

  it("the reset-modal 'Refresh my plan' is a SOLID primary (the safe affirmative path)", () => {
    expect(BUNDLE).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,160}accessibilityLabel="Refresh my plan"/,
    );
  });

  it("none of the migrated bundle CTAs regress to the retired aubergine outline border", () => {
    expect(BUNDLE).not.toMatch(
      /testID="settings-bundle-name-save"[\s\S]{0,300}borderColor:\s*(?:accent|Accent)\.primarySolid/,
    );
    expect(BUNDLE).not.toMatch(
      /testID="settings-bundle-promo-code-apply"[\s\S]{0,300}borderColor:\s*(?:accent|Accent)\.primarySolid/,
    );
  });

  // NOTE: there is no "Copy" SupprButton in SettingsBundleContent — the bundle
  // surface exposes name Save / inline Saves / Manage / Apply / Refresh-my-plan,
  // not a Copy action. Nothing to pin for "Copy"; intentionally omitted rather
  // than asserting a control that doesn't exist.
});
