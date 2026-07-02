/**
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const normalize = (value: string) => value.replace(/\s+/g, " ");

/**
 * ENG-1155 forward-fix — Part 2 only. The base file at 20260615180000 was skipped
 * by db push because MCP stamped eng845 at the same version. Part 1 (referrals
 * subselect wrap) is already live; this migration consolidates overlapping
 * permissive policies on four tables.
 */
describe("ENG-1155 RLS permissive forward-fix migration", () => {
  const sql = read(
    "supabase/migrations/20260702130100_eng1155_rls_perf_permissive_forward_fix.sql",
  );
  const normalized = normalize(sql);

  it("does not re-alter referrals policies (Part 1 already on prod)", () => {
    expect(normalized).not.toMatch(/alter policy "referrals_select_own"/i);
    expect(normalized).not.toMatch(/alter policy "referral_credits_select_own"/i);
  });

  it("replaces legacy household_members policies with per-command names", () => {
    expect(normalized).toContain('DROP POLICY IF EXISTS "Members can read household members"');
    expect(normalized).toContain('CREATE POLICY "household_members_select_member_or_owner"');
    expect(normalized).toContain('CREATE POLICY "household_members_insert_self_or_owner"');
    expect(normalized).toContain('CREATE POLICY "household_members_update_self_or_owner"');
    expect(normalized).toContain('CREATE POLICY "household_members_delete_self_or_owner"');
  });

  it("splits households owner FOR ALL into per-command policies", () => {
    expect(normalized).toContain('DROP POLICY IF EXISTS "Household owner full access"');
    expect(normalized).toContain('CREATE POLICY "households_select_member_or_owner"');
    expect(normalized).toContain('CREATE POLICY "households_insert_owner"');
    expect(normalized).toContain('CREATE POLICY "households_update_owner"');
    expect(normalized).toContain('CREATE POLICY "households_delete_owner"');
  });

  it("splits recipe_ingredients write policy into insert/update/delete", () => {
    expect(normalized).toContain('DROP POLICY IF EXISTS "recipe_ingredients_write_own_recipe"');
    expect(normalized).toContain('CREATE POLICY "recipe_ingredients_insert_own_recipe"');
    expect(normalized).toContain('CREATE POLICY "recipe_ingredients_update_own_recipe"');
    expect(normalized).toContain('CREATE POLICY "recipe_ingredients_delete_own_recipe"');
    expect(normalized).not.toContain('CREATE POLICY "recipe_ingredients_select_public"');
  });

  it("splits verified_food_canonical admin upsert into insert/update/delete", () => {
    expect(normalized).toContain('DROP POLICY IF EXISTS "Admins can upsert canonical verified foods"');
    expect(normalized).toContain('CREATE POLICY "verified_food_canonical_insert_admin"');
    expect(normalized).toContain('CREATE POLICY "verified_food_canonical_update_admin"');
    expect(normalized).toContain('CREATE POLICY "verified_food_canonical_delete_admin"');
  });
});
