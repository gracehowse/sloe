import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ENG-845 (ENG-557 F4) — pin the search_path pg_temp hardening migration
 * shape. There is no live DB in CI (the migration-apply rule forbids
 * `db push` here), so the live effect is confirmed by the Supabase advisor
 * lints (0028/0029) after Grace pushes. This file pins the migration SOURCE
 * so a refactor that drops a function, mangles a signature, or reverts a
 * function to bare `search_path = public` fails CI.
 *
 * Pattern mirrors saveMealPlanRpcMigration / claimWebPushSubscriptionMigration.
 */

const SQL = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260615180000_eng845_search_path_pg_temp_hardening.sql",
  ),
  "utf-8",
);

// Executable SQL only — `--` line comments stripped. The header documents the
// scope guardrails (and so legitimately *names* the out-of-scope functions in
// prose); the negative "does not touch" assertions must check statements, not
// the comments that explain why those functions are excluded.
const EXEC_SQL = SQL.replace(/--.*$/gm, "");

// Exact function + identity-argument list every ALTER must cover. Signatures
// confirmed against the committed CREATE OR REPLACE statements in
// supabase/migrations/ (see the migration header for per-function sources).
const FUNCTIONS: ReadonlyArray<{ name: string; args: string }> = [
  // auth_* RLS helpers
  { name: "auth_household_ids", args: "" },
  { name: "auth_user_save_count", args: "" },
  { name: "auth_profile_user_tier", args: "" },
  // public_* social/save stat RPCs
  { name: "public_recipe_save_count", args: "uuid" },
  { name: "public_creator_follower_count", args: "uuid" },
  { name: "public_author_follower_count", args: "uuid" },
  { name: "public_recipe_save_counts_batch", args: "uuid\\[\\]" },
  // my_recipe_* author-scoped stat RPCs
  { name: "my_recipe_save_stats", args: "" },
  { name: "my_recipe_plan_add_stats", args: "" },
  // user_foods_* trigger functions
  { name: "user_foods_guard_status_transition", args: "" },
  { name: "user_foods_reset_verification_on_macro_edit", args: "" },
  { name: "user_foods_after_status_change", args: "" },
];

describe("ENG-845 search_path pg_temp hardening migration shape", () => {
  it("runs inside a single explicit transaction", () => {
    expect(SQL).toMatch(/^\s*begin;/im);
    expect(SQL).toMatch(/^\s*commit;/im);
  });

  it.each(FUNCTIONS)(
    "pins $name($args) to search_path = public, pg_temp",
    ({ name, args }) => {
      const stmt = new RegExp(
        `alter function public\\.${name}\\s*\\(\\s*${args}\\s*\\)\\s*set search_path = public, pg_temp;`,
        "i",
      );
      expect(SQL).toMatch(stmt);
    },
  );

  it("covers exactly the 12 in-scope functions (one ALTER each, no extras)", () => {
    const alterCount = (EXEC_SQL.match(/alter function public\./gi) ?? []).length;
    expect(alterCount).toBe(FUNCTIONS.length);
  });

  it("never sets a bare `search_path = public` without pg_temp (no regression)", () => {
    // A bare `set search_path = public` (not followed by `, pg_temp`) on any
    // ALTER would re-open the consistency gap this migration closes.
    expect(EXEC_SQL).not.toMatch(/set search_path = public\s*;/i);
  });

  it("is ALTER-only — it does NOT touch grants/EXECUTE (scope guardrail)", () => {
    expect(EXEC_SQL).not.toMatch(/\b(revoke|grant)\b/i);
  });

  it("does NOT touch the intended-public household_invite_* / redeem RPCs", () => {
    // These were assessed SAFE by the ENG-557 audit and must stay untouched.
    // Checked against executable SQL only (the header names them in prose to
    // document the scope guardrail).
    expect(EXEC_SQL).not.toMatch(/household_invite/i);
    expect(EXEC_SQL).not.toMatch(/household_join_by_invite_code/i);
    expect(EXEC_SQL).not.toMatch(/redeem_promo_code/i);
    expect(EXEC_SQL).not.toMatch(/recompute_verified_food_canonical/i);
  });
});
