import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SQL = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260702126300_eng1052_schema_hardening.sql",
  ),
  "utf-8",
);

const EXEC_SQL = SQL.replace(/--.*$/gm, "");

describe("ENG-1052 schema hardening migration", () => {
  it("validates the existing nutrition_entries.source canonical CHECK", () => {
    expect(EXEC_SQL).toMatch(
      /alter table public\.nutrition_entries\s+validate constraint nutrition_entries_source_canonical;/i,
    );
    expect(EXEC_SQL).not.toMatch(/add constraint nutrition_entries_source_canonical/i);
  });

  it("keeps save_verified_ingredients SECURITY INVOKER with a pinned pg_temp search_path", () => {
    expect(EXEC_SQL).toMatch(/create or replace function public\.save_verified_ingredients\s*\(/i);
    expect(EXEC_SQL).toMatch(/security invoker\s+set search_path = public, pg_temp\s+as \$\$/i);
    expect(EXEC_SQL).not.toMatch(/security definer/i);
  });

  it("rejects non-authenticated and non-author RPC callers with 42501", () => {
    expect(EXEC_SQL).toMatch(/auth\.uid\(\)/i);
    expect(EXEC_SQL).toMatch(/save_verified_ingredients: not authenticated[\s\S]*errcode = '42501'/i);
    expect(EXEC_SQL).toMatch(
      /not exists \([\s\S]*from recipes[\s\S]*where id = p_recipe_id[\s\S]*and author_id = v_user_id[\s\S]*\)/i,
    );
    expect(EXEC_SQL).toMatch(/save_verified_ingredients: not recipe author[\s\S]*errcode = '42501'/i);
  });

  it("preserves ENG-1244 by not writing recipe-level trust columns", () => {
    const recipeUpdateBlock = EXEC_SQL.match(/update recipes set[\s\S]*?where id = p_recipe_id;/i)?.[0] ?? "";

    expect(recipeUpdateBlock).not.toMatch(/\bis_verified\s*=/i);
    expect(recipeUpdateBlock).not.toMatch(/\bverified_source\s*=/i);
    expect(recipeUpdateBlock).not.toMatch(/\bverified_at\s*=/i);
    expect(recipeUpdateBlock).not.toMatch(/\bverified_confidence\s*=/i);
  });

  it("documents the non-SQL calories and HIBP resolutions", () => {
    expect(SQL).toMatch(/no calorie-bearing smallint columns/i);
    expect(SQL).toMatch(/HIBP leaked-password protection is also intentionally not DDL/i);
  });

  it("reloads PostgREST schema after the RPC replacement", () => {
    expect(EXEC_SQL).toMatch(/notify pgrst, 'reload schema';/i);
  });
});
