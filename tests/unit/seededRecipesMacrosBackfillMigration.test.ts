/**
 * Build 41 follow-up (2026-05-01) — F-71 sibling.
 *
 * Pin: the seeded-recipes macros backfill migration only touches the
 * 20 URL-seeded Discover rows, only when calories <= 0 / NULL, and
 * computes per-serving values from the SUM of recipe_ingredients
 * macros (idempotent re-runs, manifest-bound).
 *
 * Authority: docs/decisions/2026-05-01-seeded-recipes-macros-backfill.md
 * (created in same PR).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SQL = readFileSync(
  join(process.cwd(), "supabase/migrations/20260503113000_seeded_recipes_macros_backfill.sql"),
  "utf8",
);

describe("20260503113000_seeded_recipes_macros_backfill — Build 41", () => {
  it("uses the same 20-URL canonical seed list as the unpoison migration", () => {
    // Spot-check 4 distinct sites — covers the 5 that ship in the seed
    // manifest. If a future edit drops one of these the migration
    // would silently leave macros unfilled.
    expect(SQL).toContain("https://cookieandkate.com/best-lentil-soup-recipe/");
    expect(SQL).toContain("https://downshiftology.com/recipes/best-shakshuka-recipe/");
    expect(SQL).toContain("https://minimalistbaker.com/spicy-red-lentil-curry/");
    expect(SQL).toContain("https://pinchofyum.com/easy-red-lentil-dhal");
    expect(SQL).toContain("https://www.halfbakedharvest.com/sheet-pan-chicken-fajitas/");
  });

  it("only backfills rows where calories IS NULL or <= 0 (idempotent)", () => {
    expect(SQL).toMatch(/r\.calories\s+IS\s+NULL\s+OR\s+r\.calories\s*<=\s*0/i);
  });

  it("aggregates from recipe_ingredients (the seeder's per-ingredient rows)", () => {
    expect(SQL).toMatch(/JOIN\s+recipe_ingredients\s+ri\s+ON\s+ri\.recipe_id\s*=\s*r\.id/i);
    expect(SQL).toMatch(/SUM\(COALESCE\(ri\.calories,\s*0\)\)/i);
    expect(SQL).toMatch(/SUM\(COALESCE\(ri\.protein,\s*0\)\)/i);
    expect(SQL).toMatch(/SUM\(COALESCE\(ri\.carbs,\s*0\)\)/i);
    expect(SQL).toMatch(/SUM\(COALESCE\(ri\.fat,\s*0\)\)/i);
    expect(SQL).toMatch(/SUM\(COALESCE\(ri\.fiber_g,\s*0\)\)/i);
  });

  it("divides by GREATEST(servings, 1) to compute per-serving values", () => {
    expect(SQL).toMatch(/GREATEST\(r\.servings,\s*1\)/i);
  });

  it("only matches by source_url, never by author_id (defence-in-depth)", () => {
    // The unpoison migration set author_id = NULL on these rows, so
    // matching by author_id alone would be a no-op anyway. We pin the
    // contract: source_url is the authoritative key.
    expect(SQL).toMatch(/r\.source_url\s+IN\s+\(SELECT\s+url\s+FROM\s+seed_urls\)/i);
    expect(SQL).not.toMatch(/r\.author_id\s*=/);
  });

  it("HAVING clause guards against zero-sum joins (no-op rows)", () => {
    // If the recipe has recipe_ingredients but every row is also 0,
    // the migration would still write 0 — no improvement. The HAVING
    // clause filters those out so we don't churn rows for nothing.
    expect(SQL).toMatch(/HAVING\s+SUM\(COALESCE\(ri\.calories,\s*0\)\)\s*>\s*0/i);
  });

  it("RAISE EXCEPTION when affected_count exceeds the 20-row manifest", () => {
    expect(SQL).toMatch(/IF\s+affected_count\s*>\s*20\s+THEN[\s\S]*?RAISE\s+EXCEPTION/i);
  });

  it("logs affected count via RAISE NOTICE for forensic auditing", () => {
    expect(SQL).toMatch(/RAISE\s+NOTICE\s+'Backfilled macros on % seeded recipes'/i);
  });

  it("documents the apply-via-supabase-db-push rule (CLAUDE.md project rule)", () => {
    expect(SQL).toMatch(/Apply with:\s*supabase db push/i);
    expect(SQL).toMatch(/DO NOT apply via MCP/i);
  });
});
