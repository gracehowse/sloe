/**
 * @vitest-environment node
 *
 * ENG-1307 — SECURITY DEFINER RPC execute lockdown.
 *
 * Guards the classification the migration encodes (verified against the live
 * DB read-only on 2026-07-02):
 *   A. intentionally public   → COMMENT, no revoke
 *   B. authed-only client RPC → revoke from public + anon, keep authenticated
 *   C. internal RLS helper    → revoke from public + anon, keep authenticated
 *                               (policies evaluate as the querying role)
 *   D. trigger-only fn        → revoke every RPC surface + pin search_path
 *
 * Plus a call-site contract: the pre-auth web modules may only call class-A
 * functions — if someone wires a class-B/C RPC into a pre-auth surface, the
 * anon REVOKE would break it in prod, so this test fails first.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260702126100_eng1307_rpc_execute_lockdown.sql";
const sql = readFileSync(resolve(process.cwd(), migrationPath), "utf8");
const normalized = sql.replace(/\s+/g, " ");
// Executable statements only — SQL comments stripped:
const code = sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ");

const CLASS_A_PUBLIC = [
  "public_recipe_save_count",
  "public_recipe_save_counts_batch",
  "public_author_follower_count",
  "public_creator_follower_count",
  "top_creators_by_saves",
];

const CLASS_B_AUTHED_ONLY = [
  "redeem_promo_code(text)",
  "redeem_referral_code(text)",
  "get_or_create_referral_code()",
  "household_invite_send(uuid, text)",
  "household_invite_accept(uuid)",
  "household_invite_decline(uuid)",
  "household_invite_cancel(uuid)",
  "household_join_by_invite_code(text, text)",
  "claim_web_push_subscription(text, text, text, text)",
  "my_recipe_save_stats()",
  "my_recipe_plan_add_stats()",
];

const CLASS_C_RLS_HELPERS = [
  "auth_household_ids()",
  "auth_profile_user_tier()",
  "auth_user_save_count()",
];

describe("ENG-1307 RPC execute lockdown migration", () => {
  it("revokes anon (and stale PUBLIC) from every class-B client RPC, keeping authenticated", () => {
    for (const sig of CLASS_B_AUTHED_ONLY) {
      expect(normalized).toContain(
        `revoke execute on function public.${sig} from public, anon;`,
      );
    }
    // authenticated must survive: no class-B revoke may name it.
    for (const sig of CLASS_B_AUTHED_ONLY) {
      const name = sig.split("(")[0];
      expect(normalized).not.toMatch(
        new RegExp(`revoke[^;]*public\\.${name}\\([^;]*from[^;]*authenticated`),
      );
    }
  });

  it("revokes anon from the RLS helpers but keeps authenticated for policy evaluation", () => {
    for (const sig of CLASS_C_RLS_HELPERS) {
      expect(normalized).toContain(
        `revoke execute on function public.${sig} from public, anon;`,
      );
      const name = sig.split("(")[0];
      expect(normalized).not.toMatch(
        new RegExp(`revoke[^;]*public\\.${name}\\([^;]*from[^;]*authenticated`),
      );
    }
  });

  it("strips the trigger-only function of its entire RPC surface and pins its search_path", () => {
    expect(normalized).toContain(
      "revoke execute on function public.ingredient_images_touch_updated_at() from public, anon, authenticated;",
    );
    expect(normalized).toContain(
      "alter function public.ingredient_images_touch_updated_at() set search_path = '';",
    );
  });

  it("pins the search_path stragglers the ENG-845 sweep scoped out", () => {
    for (const fn of [
      "household_invite_send(uuid, text)",
      "household_invite_accept(uuid)",
      "household_invite_decline(uuid)",
      "household_invite_cancel(uuid)",
    ]) {
      expect(normalized).toContain(
        `alter function public.${fn} set search_path = public, extensions, pg_temp;`,
      );
    }
    expect(normalized).toContain(
      "alter function public.top_creators_by_saves(integer) set search_path = public, pg_temp;",
    );
  });

  it("documents every deliberately-public function instead of revoking it", () => {
    for (const name of CLASS_A_PUBLIC) {
      expect(normalized).toMatch(
        new RegExp(
          `comment on function public\\.${name}\\([^)]*\\) is 'ENG-1307: intentionally anon-executable`,
        ),
      );
      expect(normalized).not.toMatch(
        new RegExp(`revoke[^;]*public\\.${name}\\(`),
      );
    }
  });

  it("flips the postgres default function privileges so the class of bug cannot recur", () => {
    expect(normalized).toContain(
      "alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;",
    );
    expect(normalized).toContain("notify pgrst, 'reload schema';");
  });

  it("never grants anything new to anon", () => {
    expect(code).not.toMatch(/grant[^;]*to[^;]*\banon\b/);
  });
});

describe("ENG-1307 pre-auth call-site contract", () => {
  // Modules that run before auth (public recipe pages, Discover rail,
  // pre-auth save counts). Any rpc() they call must be class A.
  const PRE_AUTH_MODULES = [
    "src/app/components/RecipeDetail.tsx",
    "src/lib/recipes/fetchPublicRecipeSaveCounts.ts",
    "src/lib/discover/topCreators.ts",
  ];

  const revokedFromAnon = new Set(
    [...CLASS_B_AUTHED_ONLY, ...CLASS_C_RLS_HELPERS].map(
      (sig) => sig.split("(")[0],
    ),
  );

  it("pre-auth modules only call intentionally-public RPCs", () => {
    for (const modulePath of PRE_AUTH_MODULES) {
      const source = readFileSync(resolve(process.cwd(), modulePath), "utf8");
      const calls = [...source.matchAll(/\.rpc\(\s*["']([a-z0-9_]+)["']/g)].map(
        (m) => m[1],
      );
      for (const fn of calls) {
        expect(
          revokedFromAnon.has(fn),
          `${modulePath} calls ${fn} pre-auth, but ENG-1307 revokes anon EXECUTE on it`,
        ).toBe(false);
      }
    }
  });
});
