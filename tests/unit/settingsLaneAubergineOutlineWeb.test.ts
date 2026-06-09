/**
 * Web Settings / Targets / goal-pace lane — Sloe aubergine-outline
 * treatment (2026-06-08). Web mirror of the mobile
 * `settingsLaneAubergineOutline.test.ts`.
 *
 * The everyday primary CTAs on the web settings surfaces (Save name, Sloe
 * Pro banner Manage, goal-pace Save) read as an aubergine OUTLINE — a 1.5px
 * `--accent-primary-solid` border + label on a transparent fill — not a
 * filled slab. The segmented control's active label carries the aubergine
 * solid (`text-primary-solid`). This is a source-level structural pin
 * (mirrors `settingsYourNameParity` / `settingsMacroTokens`); it breaks if a
 * CTA regresses to a filled `bg-primary` slab.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = process.cwd();
const SETTINGS = readFileSync(resolve(REPO, "src/app/components/Settings.tsx"), "utf8");
const DIALOG = readFileSync(
  resolve(REPO, "src/app/components/suppr/goal-pace-editor-dialog.tsx"),
  "utf8",
);
const SEGMENTED = readFileSync(
  resolve(REPO, "src/app/components/ui/settings-segmented.tsx"),
  "utf8",
);

describe("Web settings lane — aubergine OUTLINE primary CTAs", () => {
  it("the name Save button is an aubergine outline, not a filled bg-primary slab", () => {
    expect(SETTINGS).toMatch(
      /data-testid="settings-name-save"[\s\S]{0,500}--accent-primary-solid/,
    );
    // It must no longer carry the filled `bg-primary text-white` treatment.
    expect(SETTINGS).not.toMatch(
      /data-testid="settings-name-save"[\s\S]{0,200}bg-primary text-white/,
    );
  });

  it("the Sloe Pro banner Manage reads as an outline pill", () => {
    expect(SETTINGS).toMatch(
      /data-testid="settings-sloe-pro-banner"[\s\S]{0,1200}rounded-full border-\[1\.5px\][\s\S]{0,200}Manage/,
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
