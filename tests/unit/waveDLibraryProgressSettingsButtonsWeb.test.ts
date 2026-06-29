/**
 * Wave D (WEB) — Library + Progress + Settings CTA migration to SupprButton
 * (button-system canon, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * The 2026-06-12 canon retired the everyday aubergine-OUTLINE primary in
 * favour of two SupprButton variants:
 *   - PRIMARY (a surface's ONE main action) → `variant="primary"`: SOLID
 *     `bg-primary-solid` fill, white label, full pill, no border/shadow.
 *   - GHOST (secondaries / inline Save / inline card chips) → `variant="ghost"`:
 *     transparent, plum label, no border.
 *
 * Wave D is the Library + Progress + Settings sweep. These are source-level
 * structural pins (mirror `plannerButtonSystemWeb` / `progressButtonSystemWeb`)
 * — they break if a Wave-D CTA regresses to the retired outline pill or a
 * filled `bg-primary` slab so the migration can't silently drift.
 *
 * Cross-platform parity for the same CTAs is pinned mobile-side in
 * `apps/mobile/tests/unit/waveDLibraryProgressSettingsButtons.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const LIBRARY = read("src/app/components/Library.tsx");
const PROGRESS = read("src/app/components/ProgressDashboard.tsx");
// Steps + Body-Fat inputs extracted into ProgressActivitySection (ENG-1225 #21).
const PROGRESS_ACTIVITY = read("src/app/components/suppr/progress-activity-section.tsx");
const SETTINGS = read("src/app/components/Settings.tsx");
const HYDRATION = read("src/app/components/suppr/hydration-stimulants-card.tsx");

// The retired everyday aubergine-OUTLINE primary.
const OUTLINE_PILL = /border-\[1\.5px\]\s+border-primary-solid/;

describe("Wave D (web) — Library CTAs", () => {
  it("imports the shared web SupprButton primitive", () => {
    expect(LIBRARY).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr\/suppr-button(?:\.tsx)?"/,
    );
  });

  it("empty-library 'Import a recipe' is a SOLID primary (the card's ONE action)", () => {
    expect(LIBRARY).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,600}aria-label="Import a recipe"[\s\S]{0,160}Import a recipe\s*<\/SupprButton>/,
    );
  });

  it("no-matches 'Clear filters' is a GHOST secondary", () => {
    expect(LIBRARY).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,200}setSearchQuery\(""\)[\s\S]{0,40}>\s*Clear filters\s*<\/SupprButton>/,
    );
  });

  it("per-card 'Go public' is a GHOST chip (transparent, no border, plum label)", () => {
    expect(LIBRARY).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,600}>\s*Go public\s*<\/SupprButton>/,
    );
  });

  it("no Library CTA regresses to the retired aubergine outline pill", () => {
    expect(LIBRARY).not.toMatch(OUTLINE_PILL);
  });
});

describe("Wave D (web) — ProgressDashboard CTAs", () => {
  it("imports the shared web SupprButton primitive", () => {
    expect(PROGRESS).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr\/suppr-button(?:\.tsx)?"/,
    );
  });

  it("'Log weight' is a QUIET ghost (v3 prototype — the chart stays the hero)", () => {
    // ENG-1247: conformed from a filled primary to `ghost` (the prototype's
    // calm `btn--secondary` Log-weight; the trend chart is the card's hero).
    expect(PROGRESS).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,260}data-testid="progress-log-weight"[\s\S]{0,160}Log weight\s*<\/SupprButton>/,
    );
    // Handler preserved through the treatment change.
    expect(PROGRESS).toMatch(/onClick=\{\(\) => void saveTodayWeight\(\)\}/);
  });

  it("inline Saves (Steps + Body fat) are GHOST secondaries", () => {
    // In the extracted ProgressActivitySection (flag-off legacy path).
    expect(PROGRESS_ACTIVITY).toMatch(
      /<SupprButton\s+variant="ghost"\s+onClick=\{\(\) => void saveTodaySteps\(\)\}\s*>\s*Save\s*<\/SupprButton>/,
    );
    expect(PROGRESS_ACTIVITY).toMatch(
      /<SupprButton\s+variant="ghost"\s+onClick=\{\(\) => void saveBodyFat\(\)\}\s*>\s*Save\s*<\/SupprButton>/,
    );
  });

  it("SANCTIONED non-migration: the Calendar icon-only button stays a raw icon button", () => {
    // h-9 w-9 icon-only affordance, no text label — intentionally NOT a SupprButton.
    expect(PROGRESS).toMatch(
      /data-testid="progress-calendar-button"[\s\S]{0,200}h-9 w-9/,
    );
  });

  it("no migrated Progress CTA regresses to the retired aubergine outline pill", () => {
    expect(PROGRESS).not.toMatch(OUTLINE_PILL);
  });
});

describe("Wave D (web) — Settings CTAs", () => {
  it("the name Save is a GHOST SupprButton (not a filled slab or retired outline)", () => {
    expect(SETTINGS).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}data-testid="settings-name-save"/,
    );
    expect(SETTINGS).not.toMatch(
      /data-testid="settings-name-save"[\s\S]{0,200}bg-primary text-white/,
    );
    expect(SETTINGS).not.toMatch(
      /data-testid="settings-name-save"[\s\S]{0,200}border-\[1\.5px\]/,
    );
  });

  it("the Sloe Pro banner Manage reads as a GHOST pill (no border)", () => {
    expect(SETTINGS).toMatch(
      /data-testid="settings-sloe-pro-banner"[\s\S]{0,1400}rounded-full px-3\.5 py-1\.5[\s\S]{0,200}Manage/,
    );
    expect(SETTINGS).not.toMatch(
      /data-testid="settings-sloe-pro-banner"[\s\S]{0,1400}border-\[1\.5px\][\s\S]{0,200}Manage/,
    );
  });

  it("the promo Apply is a SOLID primary SupprButton (web↔mobile parity)", () => {
    // Mobile SettingsBundleContent migrated promo Apply to variant="primary"
    // (loading + same disabled gate). Web must match — it was a raw near-black
    // bg-foreground slab. Treatment-only: redeem handler unchanged.
    expect(SETTINGS).toMatch(
      /<SupprButton\s+variant="primary"\s+aria-label="Apply promo code"\s+disabled=\{promoSubmitting \|\| !promoCode\.trim\(\)\}\s+loading=\{promoSubmitting\}/,
    );
    // The redeem handler is preserved on it (treatment-only migration).
    expect(SETTINGS).toMatch(/aria-label="Apply promo code"[\s\S]{0,400}redeemPromoCode\(promoCode\)/);
    // Must NOT regress to the retired dark-fill slab.
    expect(SETTINGS).not.toMatch(/bg-foreground text-background[\s\S]{0,80}Apply/);
  });
});

describe("Wave D (web) — SANCTIONED non-migration: hydration-stimulants preset chips", () => {
  // The hydration/stimulants quick-add preset chips are tinted-fill
  // quick-actions (Today surface, NutritionTracker — NOT on ProgressDashboard).
  // They are intentionally raw <button>s, never SupprButtons — Wave D does not
  // touch them.
  it("water / caffeine / alcohol preset chips stay raw <button>s, not SupprButtons", () => {
    expect(HYDRATION).toMatch(/onClick=\{\(\) => onAddWater\(chip\.ml\)\}/);
    expect(HYDRATION).toMatch(/handleAddCaffeine\(preset\.mg, preset\.label\)/);
    expect(HYDRATION).toMatch(/handleAddAlcohol\(preset\.grams, preset\.label\)/);
    expect(HYDRATION).not.toMatch(/<SupprButton/);
  });
});
