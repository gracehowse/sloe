/**
 * Recipe sheets + create/cook CTAs (MOBILE) — Wave C-clean focused pin
 * (cohesion wave 2026-06-13, ENG-1080;
 * `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * Focused source-level pins for the recipe-lane CTA sites migrated onto the
 * shared `SupprButton` SOLID-PRIMARY / GHOST grammar, regex-source-pin style
 * mirroring `tests/unit/plannerButtonSystemWeb.test.ts`:
 *   - The three ingredient/edit sheets each pair a GHOST Cancel with a SOLID
 *     primary commit (Save / Save / Add).
 *   - The create-recipe quick-action row is three GHOST peers (no primary).
 *   - The recipe/[id] cook-stepper pairs a SOLID primary Next with a GHOST
 *     Previous.
 *
 * Grammar: primary = solid aubergine fill + white label, no border/shadow;
 * ghost = transparent + plum label + no border. A regression off the primitive
 * (back to a 1.5px outline or a beige `colors.card` slab) breaks these.
 *
 * Web parity for the upload entry CTAs:
 * `tests/unit/recipeUploadButtonSystem.test.ts`. Commit-CTA coverage lives in
 * the broader `apps/mobile/tests/unit/recipeButtonSystem.test.ts`.
 *
 * NOTE: the recipe-detail action row (Start Cooking / Log / Edit,
 * `RecipeActionPills.tsx`) is deliberately NOT pinned here — that migration is
 * deferred.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const EDIT_SHEET = read("components/recipe/RecipeEditSheet.tsx");
const OVERRIDE_SHEET = read("components/OverrideIngredientSheet.tsx");
const ADD_SHEET = read("components/AddIngredientSheet.tsx");
const CREATE_RECIPE = read("app/create-recipe.tsx");
const RECIPE_DETAIL = read("app/recipe/[id].tsx");
const COOK_MODE = read("app/cook.tsx");

describe("Recipe sheets — GHOST Cancel + SOLID primary commit (Wave C-clean 2026-06-13)", () => {
  it("RecipeEditSheet: Cancel is GHOST, Save is the sheet's SOLID primary", () => {
    expect(EDIT_SHEET).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\.\/ui\/SupprButton"/,
    );
    expect(EDIT_SHEET).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,200}label="Cancel"/);
    expect(EDIT_SHEET).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}label="Save"/);
  });

  it("OverrideIngredientSheet: Cancel is GHOST, Save is the SOLID primary (Reset stays bespoke destructive)", () => {
    expect(OVERRIDE_SHEET).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/ui\/SupprButton"/,
    );
    expect(OVERRIDE_SHEET).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,200}label="Cancel"/);
    expect(OVERRIDE_SHEET).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}label="Save"/);
    // Reset is intentionally NOT a SupprButton — it keeps its destructive style.
    expect(OVERRIDE_SHEET).toMatch(/btnDestructive:\s*\{/);
  });

  it("AddIngredientSheet: Cancel is GHOST, Add is the SOLID primary", () => {
    expect(ADD_SHEET).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/ui\/SupprButton"/,
    );
    expect(ADD_SHEET).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,200}label="Cancel"/);
    expect(ADD_SHEET).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}label="Add"/);
  });

  it("no sheet commit/cancel regresses to a 1.5px outline pill", () => {
    for (const src of [EDIT_SHEET, OVERRIDE_SHEET, ADD_SHEET]) {
      expect(src).not.toMatch(/<SupprButton[\s\S]{0,160}borderWidth:\s*1\.5/);
    }
  });
});

describe("create-recipe quick-action row — three GHOST peers (Wave C-clean 2026-06-13)", () => {
  it("imports the shared SupprButton primitive (@/ path)", () => {
    expect(CREATE_RECIPE).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("Paste list / Scan photo / Scan barcode are all GHOST (none is the primary)", () => {
    expect(CREATE_RECIPE).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,300}Paste list/);
    expect(CREATE_RECIPE).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,300}Scan photo/);
    expect(CREATE_RECIPE).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,300}Scan barcode/);
  });
});

describe("cook.tsx step navigation — SOLID primary Next / GHOST Previous (ENG-1613)", () => {
  it("imports the shared SupprButton primitive (@/ path)", () => {
    expect(COOK_MODE).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("cook nav Next Step is the SOLID primary, Previous is a GHOST SupprButton (one pill shape per row)", () => {
    expect(COOK_MODE).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,200}label=\{current === totalSteps - 1 \? "Done!" : "Next Step"\}/);
    expect(COOK_MODE).toMatch(/<SupprButton\s+variant="ghost"[\s\S]{0,300}label="Previous"/);
  });

  it("the hand-rolled 'navBtn' rect styles are gone (Previous is a bare SupprButton ghost)", () => {
    expect(COOK_MODE).not.toContain("navBtn:");
    expect(COOK_MODE).not.toContain("navBtnText:");
    expect(COOK_MODE).not.toContain("navBtnDisabled:");
  });
});
