/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("ENG-869 recipe content_origin writes", () => {
  it("plan and shared import paths persist imported_stub", () => {
    expect(read("src/lib/planning/planImport/persistImportRecipe.ts")).toMatch(
      /content_origin:\s*"imported_stub"/,
    );
    expect(read("src/lib/recipes/persistImportedRecipe.ts")).toMatch(
      /content_origin:\s*"imported_stub"/,
    );
  });

  it("web first-party creation writes first_party unless it is saving an attributed import stub", () => {
    const src = read("src/app/components/RecipeUpload.tsx");
    expect(src).toMatch(/content_origin:\s*attributionUrl\s*\?\s*"imported_stub"\s*:\s*"first_party"/);
    expect(read("src/context/AppDataContext.tsx")).toMatch(/content_origin:\s*"first_party"/);
  });

  it("migration backfills source_url rows only and documents non-destructive private-copy semantics", () => {
    const sql = read("supabase/migrations/20260620120200_eng869_recipes_content_origin.sql");
    expect(sql).toContain("recipe_content_origin");
    expect(sql).toContain("'first_party', 'imported_stub', 'claimed'");
    expect(sql).toMatch(/set content_origin = 'imported_stub'\s+where source_url is not null/i);
    expect(sql).toContain("must never mutate private imported rows");
  });
});
