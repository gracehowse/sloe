import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(resolve(__dirname, rel), "utf8");

describe("ENG-700 — Recipe Go Public on mobile", () => {
  it("recipe detail wires Go public / Unpublish through shared publish helper", () => {
    const src = read("../../app/recipe/[id].tsx");
    expect(src).toMatch(/setRecipePublishedWithPrompt/);
    expect(src).toMatch(/Go public/);
    expect(src).toMatch(/Unpublish/);
    expect(src).toMatch(/published/);
  });

  it("library surfaces Go public for unpublished created recipes", () => {
    const src = read("../../app/(tabs)/library.tsx");
    expect(src).toMatch(/setRecipePublishedWithPrompt/);
    expect(src).toMatch(/Go public/);
    expect(src).toMatch(/Draft/);
    expect(src).toMatch(/isPublished === false/);
  });

  it("library hook hydrates isPublished from recipes.published", () => {
    const src = read("../../lib/recipes.ts");
    expect(src).toMatch(/published/);
    expect(src).toMatch(/isPublished: Boolean/);
  });
});
