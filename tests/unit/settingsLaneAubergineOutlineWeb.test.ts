/**
 * Web Settings / Targets / goal-pace lane — Sloe button-system canon
 * (2026-06-12, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 * Web mirror of the mobile `settingsLaneAubergineOutline.test.ts`.
 *
 * The 2026-06-12 canon retired the everyday aubergine-OUTLINE primary in
 * favour of two SupprButton variants: `primary` (solid aubergine pill, white
 * label — a surface's ONE main action) and `ghost` (transparent, no border,
 * plum label — secondaries / inline Save / Manage). On the Settings surfaces
 * the name Save + the Sloe Pro banner Upgrade are GHOST. The segmented
 * control's active label still carries the aubergine solid
 * (`text-primary-solid`). This is a source-level structural pin (mirrors
 * `settingsYourNameParity` / `settingsMacroTokens`); it breaks if a CTA
 * regresses to a filled `bg-primary` slab or the retired outline.
 *
 * NOTE: the goal-pace Save (dialog) is OUT of scope for the 2026-06-12
 * Settings CTA migration and still asserts the aubergine outline below.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = process.cwd();
const SETTINGS = readFileSync(resolve(REPO, "src/app/components/Settings.tsx"), "utf8");
const PRO_BANNER = readFileSync(resolve(REPO, "src/app/components/settings/settings-sloe-pro-banner.tsx"), "utf8");
const DIALOG = readFileSync(
  resolve(REPO, "src/app/components/suppr/goal-pace-editor-dialog.tsx"),
  "utf8",
);
const SEGMENTED = readFileSync(
  resolve(REPO, "src/app/components/ui/settings-segmented.tsx"),
  "utf8",
);

describe("Web settings lane — Sloe button canon (ghost secondaries)", () => {
  it("the name Save button is a SupprButton ghost, not a filled slab or the retired outline", () => {
    expect(SETTINGS).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}data-testid="settings-name-save"/,
    );
    // It must no longer carry the filled `bg-primary text-white` treatment
    // nor the retired aubergine 1.5px outline.
    expect(SETTINGS).not.toMatch(
      /data-testid="settings-name-save"[\s\S]{0,200}bg-primary text-white/,
    );
    expect(SETTINGS).not.toMatch(
      /data-testid="settings-name-save"[\s\S]{0,200}border-\[1\.5px\]/,
    );
  });

  it("the Sloe Pro banner Upgrade is a ghost pill for free users; Pro shows Active status (ENG-1615)", () => {
    // Pro users: plain Active status — manage lives in SubscriptionCard.
    // Free users: decorative Upgrade ghost pill on the Link row.
    expect(SETTINGS).toContain("SettingsSloeProBanner");
    expect(PRO_BANNER).toMatch(
      /data-testid="settings-sloe-pro-banner"[\s\S]{0,1400}rounded-full px-3 py-1[\s\S]{0,200}Upgrade/,
    );
    expect(PRO_BANNER).toMatch(/>\s*Active\s*</);
    expect(PRO_BANNER).not.toMatch(
      /data-testid="settings-sloe-pro-banner"[\s\S]{0,1400}border-\[1\.5px\][\s\S]{0,200}Manage/,
    );
  });

  it("the goal-pace Save (dialog) is an aubergine outline", () => {
    expect(DIALOG).toMatch(
      /data-testid="goal-pace-editor-save"[\s\S]{0,300}border-\[var\(--accent-primary-solid\)\]/,
    );
  });

  it("the segmented control active label is the aubergine solid", () => {
    expect(SEGMENTED).toContain("border-primary bg-primary/10 text-primary-solid");
  });
});
