/**
 * @vitest-environment node
 *
 * ENG-1637 — `save_verified_ingredients` assigned a jsonb value directly to
 * `recipes.allergens text[]` (`allergens = p_recipe_update->'allergens'`).
 * Postgres has no assignment cast from jsonb to text[], so this threw 42804
 * unconditionally on every call whose payload includes an `allergens` key —
 * every real caller does — aborting the whole write. Silently broken on both
 * platforms since 2026-05-27; first caught by a live `supabase db lint
 * --linked` run (ENG-1628/ENG-1354).
 *
 * Migration-text assertions only (no live Postgres in CI), matching the
 * established convention for this function (see
 * recipeVerifiedAggregateWriteback.test.ts, ENG-1415/1417).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260721130000_eng1637_verify_allergens_cast.sql"),
  "utf8",
);
const CODE = MIGRATION.replace(/--[^\n]*/g, "");

describe("ENG-1637 — save_verified_ingredients allergens jsonb->text[] cast fix", () => {
  it("no longer assigns the raw jsonb expression directly to allergens", () => {
    expect(CODE).not.toMatch(/allergens\s*=\s*p_recipe_update->'allergens'\s*,/i);
  });

  it("extracts the jsonb array into text[] via jsonb_array_elements_text + array_agg", () => {
    expect(CODE).toMatch(
      /array_agg\(value\)\s+from\s+jsonb_array_elements_text\(p_recipe_update->'allergens'\)/i,
    );
  });

  it("distinguishes 'key absent' (keep existing) from 'key present as an array' (apply, including empty)", () => {
    // Absent branch: checks presence with `?` and keeps the column's own value.
    expect(CODE).toMatch(/not\s*\(\s*p_recipe_update\s*\?\s*'allergens'\s*\)\s*then\s+allergens/i);
    // Present-array branch: gated on jsonb_typeof = 'array'.
    expect(CODE).toMatch(/jsonb_typeof\(p_recipe_update->'allergens'\)\s*=\s*'array'/i);
  });

  it("an empty allergens array clears to '{}', not the stale prior value (the bug in the originally-suggested coalesce-only fix)", () => {
    // array_agg over zero rows is NULL; must coalesce that NULL to '{}'::text[],
    // NOT to the `allergens` column (which would silently keep stale data).
    const arrayBranch = CODE.match(
      /jsonb_typeof\(p_recipe_update->'allergens'\)\s*=\s*'array'\s+then\s+coalesce\(([\s\S]*?)\)\s*,?\s*\n\s*else/i,
    );
    expect(arrayBranch).not.toBeNull();
    expect(arrayBranch![1]).toMatch(/'\{\}'::text\[\]/);
    expect(arrayBranch![1]).not.toMatch(/,\s*allergens\s*$/);
  });

  it("a non-array (malformed) allergens value falls back to keeping the existing value rather than throwing", () => {
    expect(CODE).toMatch(/else\s+allergens\s*\n?\s*end\s*,/i);
  });

  it("preserves the ENG-1543 ingredient-level numeric casts unchanged (regression guard)", () => {
    expect(CODE).toMatch(/calories\s+=\s*\(v_ing->>'calories'\)::numeric/i);
    expect(CODE).toMatch(/protein\s+=\s*\(v_ing->>'protein'\)::numeric/i);
    expect(CODE).toMatch(/carbs\s+=\s*\(v_ing->>'carbs'\)::numeric/i);
    expect(CODE).toMatch(/fat\s+=\s*\(v_ing->>'fat'\)::numeric/i);
  });

  it("preserves the ENG-1415/1417 server-side trust-column aggregation unchanged (regression guard)", () => {
    expect(CODE).toMatch(/v_all_verified\s+boolean\s*:=\s*true/i);
    expect(CODE).toMatch(/is_verified\s*=\s*v_all_verified/i);
    expect(CODE).toMatch(
      /perform\s+set_config\('app\.recipes_trust_write_allowed',\s*'true',\s*true\)/i,
    );
  });

  it("documents applying via supabase db push --linked, not MCP apply_migration", () => {
    expect(MIGRATION).toMatch(/supabase db push --linked/);
    expect(MIGRATION).toMatch(/NOT MCP apply_migration/);
  });
});

describe("ENG-1637 — get_or_create_referral_code lint-noise fix", () => {
  const REFERRAL_MIGRATION = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260721130100_eng1637_referral_code_lint_noise.sql"),
    "utf8",
  );
  const REFERRAL_CODE = REFERRAL_MIGRATION.replace(/--[^\n]*/g, "");

  it("adds a trailing return after the retry loop (silences the plpgsql_check false positive)", () => {
    expect(REFERRAL_CODE).toMatch(/end loop;\s*\n\s*return null;\s*\n\s*end;\s*\n\$\$;/i);
  });

  it("preserves the original retry-loop behavior unchanged (regression guard)", () => {
    expect(REFERRAL_CODE).toMatch(/if v_attempt >= 8 then\s*\n\s*raise;/i);
    expect(REFERRAL_CODE).toMatch(/when unique_violation then/i);
  });

  it("documents applying via supabase db push --linked, not MCP apply_migration", () => {
    expect(REFERRAL_MIGRATION).toMatch(/supabase db push --linked/);
    expect(REFERRAL_MIGRATION).toMatch(/NOT MCP apply_migration/);
  });
});
