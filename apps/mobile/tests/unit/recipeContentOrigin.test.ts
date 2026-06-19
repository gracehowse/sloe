import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");
const readRoot = (path: string) => readFileSync(resolve(__dirname, "../../../..", path), "utf8");

describe("ENG-869 mobile recipe content_origin writes", () => {
  it("mobile first-party create surfaces persist first_party", () => {
    expect(read("app/create-recipe.tsx")).toMatch(/content_origin:\s*"first_party"/);
    expect(read("components/recipe/CreateRecipeWizard.tsx")).toMatch(/content_origin:\s*"first_party"/);
  });

  it("mobile shared import flow uses the shared imported_stub persist chokepoint", () => {
    expect(readRoot("src/lib/recipes/persistImportedRecipe.ts")).toMatch(
      /content_origin:\s*"imported_stub"/,
    );
    expect(read("app/import-shared.tsx")).toMatch(/persistImportedRecipe|saveImportedRecipe/);
  });

  it("mobile recipe mapper exposes contentOrigin in parity with web", () => {
    const src = read("lib/recipes.ts");
    expect(src).toContain("content_origin");
    expect(src).toContain("contentOrigin");
  });
});
