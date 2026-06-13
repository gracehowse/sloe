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
const EDIT_SHEET = read("components/recipe/RecipeEditSheet.tsx");
const OVERRIDE_SHEET = read("components/OverrideIngredientSheet.tsx");
const ADD_SHEET = read("components/AddIngredientSheet.tsx");
const CREATE_RECIPE = read("app/create-recipe.tsx");
const RECIPE_DETAIL = read("app/recipe/[id].tsx");

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

describe("RecipeEditSheet footer — solid primary / ghost (button system 2026-06-12)", () => {
  it("imports the shared SupprButton primitive (relative path)", () => {
    expect(EDIT_SHEET).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\.\/ui\/SupprButton"/,
    );
  });

  it("Cancel is a GHOST secondary", () => {
    expect(EDIT_SHEET).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,200}label="Cancel"/,
    );
  });

  it("Save is the sheet's ONE solid primary", () => {
    expect(EDIT_SHEET).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,200}label="Save"/,
    );
  });

  it("the retired aubergine-outline Save + border Cancel styles are gone", () => {
    expect(EDIT_SHEET).not.toMatch(/saveBtn:\s*\{/);
    expect(EDIT_SHEET).not.toMatch(/cancelBtn:\s*\{/);
    expect(EDIT_SHEET).not.toMatch(/borderWidth:\s*1\.5/);
  });
});

describe("OverrideIngredientSheet footer — solid primary / ghost; Reset stays destructive", () => {
  it("imports the shared SupprButton primitive (./ui path)", () => {
    expect(OVERRIDE_SHEET).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/ui\/SupprButton"/,
    );
  });

  it("Cancel is GHOST, Save is the solid primary", () => {
    expect(OVERRIDE_SHEET).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,200}label="Cancel"/);
    expect(OVERRIDE_SHEET).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}label="Save"/);
  });

  it("the retired ad-hoc primary/ghost styles are gone but destructive Reset is untouched", () => {
    expect(OVERRIDE_SHEET).not.toMatch(/btnPrimary:\s*\{/);
    expect(OVERRIDE_SHEET).not.toMatch(/btnGhost:\s*\{/);
    // Reset keeps its bespoke destructive treatment — NOT a SupprButton.
    expect(OVERRIDE_SHEET).toMatch(/btnDestructive:\s*\{/);
    expect(OVERRIDE_SHEET).toMatch(/Reset to match/);
  });
});

describe("AddIngredientSheet footer — solid primary / ghost (Find match stays a body action)", () => {
  it("imports the shared SupprButton primitive (./ui path)", () => {
    expect(ADD_SHEET).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/ui\/SupprButton"/,
    );
  });

  it("Cancel is GHOST, Add is the solid primary", () => {
    expect(ADD_SHEET).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,200}label="Cancel"/);
    expect(ADD_SHEET).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}label="Add"/);
  });

  it("the retired ad-hoc footer primary/ghost styles are gone", () => {
    expect(ADD_SHEET).not.toMatch(/btnPrimary:\s*\{/);
    expect(ADD_SHEET).not.toMatch(/btnGhost:\s*\{/);
  });
});

describe("create-recipe quick-action row — three GHOST peers (none is the primary)", () => {
  it("imports the shared SupprButton primitive (@/ path)", () => {
    expect(CREATE_RECIPE).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("Paste list / Scan photo / Scan barcode are all ghost peers", () => {
    expect(CREATE_RECIPE).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,300}Paste list/);
    expect(CREATE_RECIPE).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,300}Scan photo/);
    expect(CREATE_RECIPE).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,300}Scan barcode/);
  });

  it("the retired hairline-card + clay-fill quick-action styles are gone", () => {
    // quickBtn is now layout-only (icon→label gap); the border/card-fill and the
    // redesign clay-fill lift were removed so none of the three reads as primary.
    expect(CREATE_RECIPE).not.toMatch(/quickBtnPrimary:\s*\{/);
    expect(CREATE_RECIPE).not.toMatch(/quickBtnTextPrimary:/);
  });
});

describe("recipe/[id] cook stepper + error recovery — solid primary / ghost", () => {
  it("imports the shared SupprButton primitive (@/ path)", () => {
    expect(RECIPE_DETAIL).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("cook-stepper Next is the solid primary, Previous is ghost", () => {
    expect(RECIPE_DETAIL).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,160}label="Next"/);
    expect(RECIPE_DETAIL).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,160}label="Previous"/);
  });

  it("error-state 'Go back' is the sole recovery solid primary", () => {
    expect(RECIPE_DETAIL).toMatch(/<SupprButton\s+variant="primary"\s+label="Go back"/);
  });

  it("the retired cook-Next outline + bordered back-button styles are gone", () => {
    expect(RECIPE_DETAIL).not.toMatch(/cookNextOutline/);
    expect(RECIPE_DETAIL).not.toMatch(/backBtn:\s*\{/);
  });
});
