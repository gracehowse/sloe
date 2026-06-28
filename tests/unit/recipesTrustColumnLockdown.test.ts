/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260702120400_eng1244_recipes_trust_column_lockdown.sql";
const sql = readFileSync(resolve(process.cwd(), migrationPath), "utf8");
const normalized = sql.replace(/\s+/g, " ");

describe("ENG-1244 recipes trust-column lockdown migration", () => {
  it("adds a client-role trigger that rejects recipe-level trust writes", () => {
    expect(normalized).toContain("create or replace function public.recipes_trust_column_lockdown()");
    expect(normalized).toContain("v_role not in ('anon', 'authenticated')");
    expect(normalized).toContain("new.is_verified is distinct from old.is_verified");
    expect(normalized).toContain("recipes.is_verified is server-owned");
    expect(normalized).toContain("before insert or update on public.recipes");
  });

  it("keeps save_verified_ingredients from writing caller-supplied recipe is_verified", () => {
    const fnStart = normalized.indexOf("create or replace function public.save_verified_ingredients");
    const grantsStart = normalized.indexOf("grant execute on function public.save_verified_ingredients");
    expect(fnStart).toBeGreaterThan(-1);
    expect(grantsStart).toBeGreaterThan(fnStart);
    const fn = normalized.slice(fnStart, grantsStart);

    expect(fn).toContain("update recipes set");
    expect(fn).not.toContain("is_verified = (p_recipe_update->>'is_verified')::boolean");
  });

  it("replaces anon broad SELECT with a safe projection that omits claim evidence", () => {
    expect(normalized).toContain("revoke select on table public.recipes from anon");
    expect(normalized).toContain("grant select (");
    expect(normalized).toContain("content_origin");
    expect(normalized).not.toMatch(/grant select \([^;]*(claimed_by|claimed_at|claim_verification)[^;]*\) on public\.recipes to anon/i);
  });
});
