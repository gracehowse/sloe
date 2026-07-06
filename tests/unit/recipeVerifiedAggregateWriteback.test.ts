/**
 * @vitest-environment node
 *
 * ENG-1415/1417 — restores a legitimate write path for
 * recipes.is_verified/verified_confidence/verified_source, which ENG-1244
 * (2026-07-02) inadvertently removed (confirmed live: `save_verified_ingredients`
 * only updated macro columns, never the trust columns, after that migration).
 *
 * Migration-text assertions only (no live Postgres in CI). Structural
 * verification against the live DB was run manually this session: confirmed
 * via `pg_get_functiondef` that the deployed `save_verified_ingredients` and
 * `recipes_trust_column_lockdown` bodies match this migration exactly.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  resolve(
    __dirname,
    "../../supabase/migrations/20260706120000_eng1415_recipe_verified_aggregate_writeback.sql",
  ),
  "utf8",
);
const CODE = MIGRATION.replace(/--[^\n]*/g, "");

describe("ENG-1415/1417 — save_verified_ingredients computes recipes.is_verified server-side", () => {
  it("aggregates is_verified as worst-case-wins over the ingredient array (any unverified row fails the whole recipe)", () => {
    expect(CODE).toMatch(/v_all_verified\s+boolean\s*:=\s*true/i);
    expect(CODE).toMatch(/if\s+not\s+v_this_verified\s+then\s+v_all_verified\s*:=\s*false/i);
  });

  it("an empty ingredient array never counts as verified", () => {
    expect(CODE).toMatch(/if\s+v_ing_count\s*=\s*0\s+then\s+v_all_verified\s*:=\s*false/i);
  });

  it("verified_confidence is the MINIMUM per-ingredient confidence (weakest link), not an average", () => {
    expect(CODE).toMatch(
      /v_this_confidence\s+is\s+not\s+null\s+and\s*\(\s*v_min_confidence\s+is\s+null\s+or\s+v_this_confidence\s*<\s*v_min_confidence\s*\)/i,
    );
  });

  it("recipes.is_verified/verified_confidence/verified_source/verified_at are only set when v_all_verified, else null", () => {
    expect(CODE).toMatch(/is_verified\s*=\s*v_all_verified/i);
    expect(CODE).toMatch(/verified_confidence\s*=\s*case\s+when\s+v_all_verified\s+then\s+v_min_confidence\s+else\s+null\s+end/i);
    expect(CODE).toMatch(/verified_source\s*=\s*case\s+when\s+v_all_verified\s+then\s+'recipe_ingredients_aggregate'\s+else\s+null\s+end/i);
    expect(CODE).toMatch(/verified_at\s*=\s*case\s+when\s+v_all_verified\s+then\s+now\(\)\s+else\s+null\s+end/i);
  });

  it("never trusts a client-supplied recipe-level is_verified field from p_recipe_update", () => {
    expect(CODE).not.toMatch(/p_recipe_update->>'is_verified'/i);
  });

  it("sets the transaction-local escape-hatch GUC before the trust-column write", () => {
    const guardIdx = CODE.search(/perform\s+set_config\('app\.recipes_trust_write_allowed',\s*'true',\s*true\)/i);
    const updateIdx = CODE.search(/update\s+recipes\s+set[\s\S]*?is_verified\s*=\s*v_all_verified/i);
    expect(guardIdx).toBeGreaterThan(-1);
    expect(updateIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(updateIdx);
  });

  it("is_local (transaction-scoped) — the third set_config argument is true, so the flag can never leak past this transaction", () => {
    expect(CODE).toMatch(/set_config\('app\.recipes_trust_write_allowed',\s*'true',\s*true\)/i);
  });
});

describe("ENG-1415/1417 — recipes_trust_column_lockdown trigger's escape hatch stays narrow", () => {
  it("checks the escape-hatch GUC as an additional bypass, not a replacement for the role check", () => {
    // Both checks must still be present — the GUC check doesn't delete the
    // original ENG-1244 role-based lockdown, it only adds one more `return
    // new` branch before it.
    expect(CODE).toMatch(/current_setting\('app\.recipes_trust_write_allowed',\s*true\)\s*=\s*'true'/i);
    expect(CODE).toMatch(/v_role\s+not\s+in\s*\(\s*'anon',\s*'authenticated'\s*\)/i);
  });

  it("direct client INSERT still rejects a non-false is_verified (ENG-1244 behavior preserved)", () => {
    expect(CODE).toMatch(
      /coalesce\(new\.is_verified,\s*false\)\s+is\s+distinct\s+from\s+false[\s\S]*?raise exception 'recipes\.is_verified is server-owned/i,
    );
  });

  it("direct client UPDATE still rejects any change to is_verified (ENG-1244 behavior preserved)", () => {
    expect(CODE).toMatch(
      /new\.is_verified\s+is\s+distinct\s+from\s+old\.is_verified[\s\S]*?raise exception 'recipes\.is_verified is server-owned/i,
    );
  });

  it("the escape hatch is not exposed via any client-callable RPC (set_config is only called from inside save_verified_ingredients' own body)", () => {
    // A crude but effective guard: `set_config` should appear exactly once
    // in the whole migration (inside save_verified_ingredients), not
    // wrapped in its own standalone `create function` that a client could
    // call directly.
    const setConfigCount = (CODE.match(/set_config\(/gi) ?? []).length;
    expect(setConfigCount).toBe(1);
    expect(CODE).not.toMatch(/create\s+(or\s+replace\s+)?function\s+public\.\w*set_config/i);
  });
});

describe("ENG-1415/1417 — migration hygiene", () => {
  it("documents applying via supabase db push --linked, not MCP apply_migration", () => {
    expect(MIGRATION).toMatch(/supabase db push --linked/);
    expect(MIGRATION).toMatch(/NOT MCP apply_migration/);
  });
});
