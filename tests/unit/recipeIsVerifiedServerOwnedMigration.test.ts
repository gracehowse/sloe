/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const normalize = (value: string) => value.replace(/\s+/g, " ");

describe("ENG-1244 recipe is_verified server-owned migration", () => {
  const sql = read(
    "supabase/migrations/20260702120400_eng1244_recipe_is_verified_server_owned.sql",
  );
  const normalized = normalize(sql);

  it("installs a trigger guard on recipes.is_verified", () => {
    expect(normalized).toMatch(/CREATE TRIGGER trg_guard_recipes_is_verified/i);
    expect(normalized).toContain("guard_recipes_is_verified_client_write");
  });

  it("removes client-set is_verified from publish WITH CHECK", () => {
    const start = normalized.indexOf('CREATE POLICY "recipes_update_own"');
    expect(start).toBeGreaterThan(-1);
    const policy = normalized.slice(start);
    expect(policy).not.toContain("is_verified = true");
  });

  it("revokes full anon SELECT and re-grants without claim columns", () => {
    expect(normalized).toMatch(/REVOKE SELECT ON public\.recipes FROM anon/i);
    expect(normalized).not.toMatch(
      /GRANT SELECT \([\s\S]*claimed_by[\s\S]*\) ON public\.recipes TO anon/i,
    );
  });
});
