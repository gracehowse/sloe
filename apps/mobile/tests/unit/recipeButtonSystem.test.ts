/**
 * Recipe + create-recipe lane — SOLID-PRIMARY / GHOST button system
 * (2026-06-12, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * The recipe-detail action row and the create-recipe wizard footer were
 * migrated from the aubergine-OUTLINE / beige-fill treatments to the shared
 * `SupprButton` grammar:
 *   - PRIMARY (the surface's ONE top action) → `variant="primary"`: SOLID
 *     aubergine fill, white label, full pill, no border, no shadow.
 *   - SECONDARY → `variant="ghost"`: transparent, plum label, no border —
 *     replaces both the old outline AND the beige `colors.card` fill.
 *
 * Source-level structural pins: they break if any documented recipe CTA
 * regresses off the SupprButton grammar (e.g. back to a 1.5px
 * `borderColor: accentInk/primarySolid` outline or a beige `colors.card`
 * slab). Web parity: `tests/unit/recipeButtonSystemWeb.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const ACTION_PILLS = read("components/recipe/RecipeActionPills.tsx");
const WIZARD = read("components/recipe/CreateRecipeWizard.tsx");

describe("Recipe detail action pills — solid primary / ghost (button system 2026-06-12)", () => {
  it("imports the shared SupprButton primitive", () => {
    expect(ACTION_PILLS).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("'Log' (Add to today) is the dominant SOLID primary with a white glyph + label", () => {
    expect(ACTION_PILLS).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,300}testID="recipe-action-log"/,
    );
    // The glyph + label ride on the solid fill → white, not plum.
    expect(ACTION_PILLS).toMatch(/<PlusCircle size=\{18\} color="#fff"/);
    // Must NOT regress to the retired aubergine outline.
    expect(ACTION_PILLS).not.toMatch(/borderWidth:\s*1\.5/);
    expect(ACTION_PILLS).not.toMatch(/borderColor:\s*outlineColor/);
  });

  it("'Edit' (owner-only) is a GHOST secondary with a plum glyph + label", () => {
    expect(ACTION_PILLS).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,300}testID="recipe-action-edit"/,
    );
    expect(ACTION_PILLS).toMatch(/<Pencil size=\{16\} color=\{accent\.primarySolid\}/);
    // Must NOT keep the old cream/off-white fill.
    expect(ACTION_PILLS).not.toMatch(/backgroundColor:\s*colors\.backgroundSecondary/);
  });
});

describe("Create-recipe wizard footer — solid primary / ghost (button system 2026-06-12)", () => {
  it("imports the shared SupprButton primitive", () => {
    expect(WIZARD).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("'Continue' (per-step) is the footer's ONE SOLID primary", () => {
    expect(WIZARD).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}label="Continue"/);
  });

  it("'Save private' is a SOLID primary (white Check glyph on the fill)", () => {
    expect(WIZARD).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}accessibilityLabel="Save recipe to private library"/,
    );
    expect(WIZARD).toMatch(/<Check size=\{20\} color="#fff"/);
  });

  it("'Publish to community' is a GHOST secondary (replaces the old off-white fill)", () => {
    expect(WIZARD).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,320}label="Publish to community"/,
    );
  });

  it("the retired aubergine-outline + beige-fill footer styles are gone", () => {
    // primaryBtn (outline) + secondaryBtn (beige fill) styles were removed in
    // favour of the primitive; only the white-on-solid label colour remains.
    expect(WIZARD).not.toMatch(/borderColor:\s*accentInk,\s*\n\s*borderRadius/);
    expect(WIZARD).not.toMatch(/secondaryBtn:\s*\{/);
  });
});
