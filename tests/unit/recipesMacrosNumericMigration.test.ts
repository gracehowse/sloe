/**
 * F-72 (2026-05-08) — pin for the recipes macros numeric widening migration.
 *
 * Authority: docs/decisions/2026-05-02-recipe-macros-numeric.md.
 *
 * Pre-fix the recipe-save crashed with
 *   `invalid input syntax for type integer: "2.3"`
 * because `recipes.{calories,protein,carbs,fat}` were INTEGER columns.
 * This migration widens them (and the matching `recipe_ingredients`
 * columns) to NUMERIC(10, 2). The pin guards three things:
 *   1. The migration file exists at the expected timestamped path.
 *   2. All eight columns are altered.
 *   3. The CLAUDE.md "apply via supabase db push, never MCP" rule is
 *      documented in the SQL preamble.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL_PATH = join(
  process.cwd(),
  "supabase/migrations/20260508100000_recipes_macros_numeric.sql",
);
const SQL = readFileSync(SQL_PATH, "utf8");

describe("20260508100000_recipes_macros_numeric — F-72", () => {
  it("alters all four per-recipe macro columns on public.recipes", () => {
    expect(SQL).toMatch(/ALTER TABLE public\.recipes/i);
    expect(SQL).toMatch(/ALTER COLUMN calories TYPE NUMERIC\(10,\s*2\)/i);
    expect(SQL).toMatch(/ALTER COLUMN protein\s+TYPE NUMERIC\(10,\s*2\)/i);
    expect(SQL).toMatch(/ALTER COLUMN carbs\s+TYPE NUMERIC\(10,\s*2\)/i);
    expect(SQL).toMatch(/ALTER COLUMN fat\s+TYPE NUMERIC\(10,\s*2\)/i);
  });

  it("alters all four per-ingredient macro columns on public.recipe_ingredients", () => {
    expect(SQL).toMatch(/ALTER TABLE public\.recipe_ingredients/i);
    // The recipe_ingredients block lives under its own ALTER TABLE so a
    // greedy regex would false-positive against the recipes block. We
    // assert the block exists and each column appears at least twice
    // (once per table).
    const recipesIngBlock = SQL.split(/ALTER TABLE public\.recipe_ingredients/i)[1] ?? "";
    expect(recipesIngBlock).toMatch(/ALTER COLUMN calories TYPE NUMERIC\(10,\s*2\)/i);
    expect(recipesIngBlock).toMatch(/ALTER COLUMN protein\s+TYPE NUMERIC\(10,\s*2\)/i);
    expect(recipesIngBlock).toMatch(/ALTER COLUMN carbs\s+TYPE NUMERIC\(10,\s*2\)/i);
    expect(recipesIngBlock).toMatch(/ALTER COLUMN fat\s+TYPE NUMERIC\(10,\s*2\)/i);
  });

  it("uses USING <col>::numeric for each ALTER COLUMN (explicit cast for non-trivial type changes)", () => {
    // Postgres requires a USING clause when changing column types in
    // ways it can't auto-cast. INTEGER -> NUMERIC is technically
    // implicit, but the explicit cast makes the migration robust if
    // any column was `smallint` instead.
    expect(SQL).toMatch(/USING calories::numeric/i);
    expect(SQL).toMatch(/USING protein::numeric/i);
    expect(SQL).toMatch(/USING carbs::numeric/i);
    expect(SQL).toMatch(/USING fat::numeric/i);
  });

  it("notifies PostgREST to reload its schema cache after the alter", () => {
    // Without this, `supabase-js` continues to send INTEGER-shaped
    // payloads against the new NUMERIC columns until the next cold
    // start of the API container. The NOTIFY makes the fix visible
    // to clients immediately.
    expect(SQL).toMatch(/NOTIFY pgrst,\s*'reload schema'/i);
  });

  it("documents the apply-via-supabase-db-push rule (CLAUDE.md project rule)", () => {
    expect(SQL).toMatch(/Apply with:\s*supabase db push/i);
    expect(SQL).toMatch(/DO NOT apply via MCP/i);
  });

  it("references the F-72 issue in the preamble for forensic auditing", () => {
    expect(SQL).toMatch(/F-72/);
    expect(SQL).toMatch(/invalid input syntax for type integer/i);
  });
});
