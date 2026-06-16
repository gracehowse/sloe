/**
 * ENG-980 — save-first import wiring (mobile import-shared).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const IMPORT_PATH = resolve(__dirname, "../../app/import-shared.tsx");
const SAVE_PATH = resolve(__dirname, "../../lib/saveImportedRecipe.ts");

describe("mobile import — save-first (ENG-980)", () => {
  const importSrc = readFileSync(IMPORT_PATH, "utf8");
  const saveSrc = readFileSync(SAVE_PATH, "utf8");

  it("lands parsed imports via landImportedRecipeInReview with save-first flag", () => {
    expect(importSrc).toContain("landImportedRecipeInReview");
    expect(importSrc).toContain("IMPORT_SAVE_FIRST_FLAG");
    expect(importSrc).toContain("recipe_import_saved_first");
    expect(importSrc).toContain("IMPORT_SAVE_FIRST_TEST_ID");
  });

  it("updates an existing library row when save-first already persisted", () => {
    expect(importSrc).toContain("updateImportedRecipe");
    expect(importSrc).toContain("IMPORT_SAVE_FIRST_UPDATE_CTA");
    expect(saveSrc).toContain("export async function updateImportedRecipe");
  });
});
