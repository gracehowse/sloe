/**
 * Recipe import lane (WEB) — SOLID-PRIMARY / GHOST button system
 * (2026-06-12, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 * Web parity for `apps/mobile/tests/unit/recipeButtonSystem.test.ts`.
 *
 * The web import flow's commit CTAs were migrated from raw `<button>` outline
 * pills (`border-[1.5px] border-primary-solid text-primary-solid`) to the
 * shared `SupprButton` grammar:
 *   - PRIMARY (each surface's ONE import/commit action) → `variant="primary"`:
 *     SOLID `bg-primary-solid` fill, white label, full pill, no border/shadow.
 *   - SECONDARY → `variant="ghost"`: transparent, plum label, no border.
 *
 * Includes a cross-platform parity pin: both `SupprButton` primitives expose
 * the identical `variant: "primary" | "ghost"` contract with the solid/ghost
 * grammar, so every call-site migration on either platform reads the same.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const UPLOAD = read("src/app/components/RecipeUpload.tsx");
const WEB_PRIMITIVE = read("src/app/components/suppr/suppr-button.tsx");
const MOBILE_PRIMITIVE = read("apps/mobile/components/ui/SupprButton.tsx");

describe("RecipeUpload import CTAs — solid primary / ghost (button system 2026-06-12)", () => {
  it("imports the shared web SupprButton primitive", () => {
    expect(UPLOAD).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr\/suppr-button(?:\.tsx)?"/,
    );
  });

  it("URL 'Import' is a SOLID primary (the import-entry commit action)", () => {
    expect(UPLOAD).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,200}runImportFromUrl\(\)/,
    );
  });

  it("'Save to my library' (import mode) is a SOLID primary", () => {
    expect(UPLOAD).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,500}IMPORT_SAVE_FIRST_UPDATE_CTA[\s\S]{0,120}Save to my library/,
    );
  });

  it("'Publish recipe' is a SOLID primary; 'Save as draft' is a GHOST secondary", () => {
    expect(UPLOAD).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,400}Publish recipe/);
    expect(UPLOAD).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,300}Save as draft/);
  });

  it("paste-match dialog: 'Match to database' is a SOLID primary, 'Cancel' is a GHOST", () => {
    expect(UPLOAD).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}Match to database/);
    expect(UPLOAD).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,160}>\s*Cancel\s*<\/SupprButton>/);
  });

  it("the migrated import CTAs no longer carry the retired raw outline pill", () => {
    // The migrated commit CTAs (Import / Save to my library / Publish / Match /
    // draft / cancel) are SupprButtons; the outline pill className must not
    // re-appear on a commit `runImportFromUrl` / `saveRecipe` button.
    expect(UPLOAD).not.toMatch(
      /<button[\s\S]{0,160}runImportFromUrl[\s\S]{0,160}border-\[1\.5px\]\s+border-primary-solid/,
    );
    expect(UPLOAD).not.toMatch(
      /<button[\s\S]{0,160}saveRecipe\(false\)[\s\S]{0,160}border-\[1\.5px\]\s+border-primary-solid/,
    );
  });
});

describe("button-system primitive — cross-platform parity (web ↔ mobile)", () => {
  it("both platforms expose the identical two-variant contract", () => {
    expect(WEB_PRIMITIVE).toMatch(/SupprButtonVariant\s*=\s*"primary"\s*\|\s*"ghost"/);
    expect(MOBILE_PRIMITIVE).toMatch(/SupprButtonVariant\s*=\s*"primary"\s*\|\s*"ghost"/);
  });

  it("both expose the same prop surface (variant / loading / disabled / label / children)", () => {
    for (const src of [WEB_PRIMITIVE, MOBILE_PRIMITIVE]) {
      expect(src).toMatch(/variant:\s*SupprButtonVariant/);
      expect(src).toMatch(/loading\??:?\s*boolean|loading\s*=\s*false/);
      expect(src).toMatch(/disabled/);
      expect(src).toMatch(/label\??:\s*string/);
      expect(src).toMatch(/children\??:\s*React\.ReactNode/);
    }
  });

  it("primary is a SOLID aubergine fill with a white label on both platforms", () => {
    // Web: bg-primary-solid + text-white. Mobile: backgroundColor primarySolid + #fff label.
    expect(WEB_PRIMITIVE).toMatch(/primary:\s*\n?[\s\S]{0,120}bg-primary-solid[\s\S]{0,60}text-white/);
    expect(MOBILE_PRIMITIVE).toMatch(
      /backgroundColor:\s*isPrimary\s*\?\s*accent\.primarySolid\s*:\s*"transparent"/,
    );
    expect(MOBILE_PRIMITIVE).toMatch(/labelColor\s*=\s*isPrimary\s*\?\s*"#fff"/);
  });

  it("ghost is transparent + plum label + NO border on both platforms", () => {
    expect(WEB_PRIMITIVE).toMatch(/ghost:\s*\n?[\s\S]{0,120}bg-transparent[\s\S]{0,60}text-primary-solid/);
    expect(WEB_PRIMITIVE).toMatch(/border-0/);
    expect(MOBILE_PRIMITIVE).not.toMatch(/borderWidth:/);
  });

  it("neither variant carries a shadow (flat-card canon — the fill IS the affordance)", () => {
    expect(WEB_PRIMITIVE).toMatch(/shadow-none/);
    expect(MOBILE_PRIMITIVE).not.toMatch(/shadow(Color|Opacity|Radius|Offset)/);
  });
});
