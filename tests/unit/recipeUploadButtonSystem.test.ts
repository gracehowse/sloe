/**
 * Recipe upload entry CTAs (WEB) — Wave C-clean SOLID-PRIMARY / GHOST cleanup
 * (cohesion wave 2026-06-13, ENG-1080;
 * `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * Wave A-1/B migrated the web import *commit* CTAs (Import / Save to my library
 * / Publish / Match / draft / cancel — pinned in
 * `tests/unit/recipeButtonSystemWeb.test.ts`). Two secondary entry actions in
 * `RecipeUpload.tsx` were the holdouts still on the retired raw `<button>`
 * outline pill (`border-[1.5px] border-primary-solid text-primary-solid`):
 *   - "Open Import recipe" — the create→import mode switch.
 *   - "Add Ingredient" — adds a blank ingredient row in the editor.
 *
 * Wave C-clean routes both through the shared `SupprButton` ghost grammar
 * (transparent, plum label, NO border), so the import surface reads as one
 * system. Both are SECONDARY (the surface's solid primary is the Import / Save
 * commit), so `variant="ghost"` is correct — neither should re-acquire a fill
 * or the outline pill.
 *
 * Regex-source-pin style mirrors `tests/unit/plannerButtonSystemWeb.test.ts`.
 * NOTE: the recipe-detail action row (Start Cooking / Log / Edit) is
 * deliberately NOT pinned here — that migration is deferred.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const UPLOAD = read("src/app/components/RecipeUpload.tsx");

const OUTLINE_PILL = /border-\[1\.5px\]\s+border-primary-solid/;

describe("RecipeUpload entry CTAs — ghost cleanup (Wave C-clean 2026-06-13)", () => {
  it("imports the shared web SupprButton primitive", () => {
    expect(UPLOAD).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr\/suppr-button(?:\.tsx)?"/,
    );
  });

  it("'Open Import recipe' (mode switch) is a GHOST SupprButton, not a fill or outline", () => {
    // Ghost variant, carries the onSwitchToImport handler, and the visible label.
    expect(UPLOAD).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,120}onClick=\{onSwitchToImport\}[\s\S]{0,160}Open Import recipe/,
    );
  });

  it("'Add Ingredient' (editor row adder) is a GHOST SupprButton, not a fill or outline", () => {
    expect(UPLOAD).toMatch(
      /<SupprButton\s+variant="ghost"[\s\S]{0,120}onClick=\{addIngredient\}[\s\S]{0,160}Add Ingredient/,
    );
  });

  it("neither migrated entry CTA carries the retired outline pill", () => {
    // The outline-pill className must not co-occur with either migrated handler
    // inside a raw <button> — the regression Wave C-clean removed.
    expect(UPLOAD).not.toMatch(
      new RegExp(
        `<button[\\s\\S]{0,200}onSwitchToImport[\\s\\S]{0,120}${OUTLINE_PILL.source}`,
      ),
    );
    expect(UPLOAD).not.toMatch(
      new RegExp(
        `<button[\\s\\S]{0,200}onClick=\\{addIngredient\\}[\\s\\S]{0,120}${OUTLINE_PILL.source}`,
      ),
    );
  });

  it("the migrated CTAs route through SupprButton's ghost grammar (no border-[1.5px] border-primary-solid on them)", () => {
    // Scope the negative assertion to the two migrated SupprButton call-sites:
    // a SupprButton element must never carry the retired outline-pill class.
    expect(UPLOAD).not.toMatch(
      new RegExp(`<SupprButton[^>]*${OUTLINE_PILL.source}`),
    );
    // And the ghost wrappers around each label must not regress to the pill.
    expect(UPLOAD).not.toMatch(
      new RegExp(
        `<SupprButton[\\s\\S]{0,120}${OUTLINE_PILL.source}[\\s\\S]{0,160}(?:Open Import recipe|Add Ingredient)`,
      ),
    );
  });
});
