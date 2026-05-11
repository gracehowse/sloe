/**
 * Phase 1 of the recipe FK cascade refactor — static-analysis tests
 * for `supabase/migrations/20260511100000_recipe_id_fk_cascade.sql`.
 *
 * Live behaviour is exercised against a real Supabase instance via
 * `supabase db push --linked`; this file pins the migration source
 * so a refactor that accidentally breaks the contract fails CI.
 *
 * Plan doc: docs/planning/schema-refactor-plan-recipe-fk-cascade.md
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260511100000_recipe_id_fk_cascade.sql"),
  "utf-8",
);

describe("recipe FK cascade — meal_plan_meals.recipe_id refactor", () => {
  it("scrubs non-UUID values from the text column before casting", () => {
    // The scrub regex must match the canonical 8-4-4-4-12 hex UUID
    // shape and NULL anything that doesn't. The `!~` operator is
    // POSIX regex negation in Postgres.
    expect(SQL).toMatch(/update public\.meal_plan_meals[\s\S]*?set recipe_id = null[\s\S]*?recipe_id !~/);
    expect(SQL).toMatch(/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$/);
  });

  it("adds the uuid column with FK ON DELETE SET NULL against recipes.id", () => {
    // SET NULL not CASCADE: a deleted recipe leaves the plan slot
    // intact (title + macros baked in) so the user doesn't lose
    // their plan structure.
    expect(SQL).toMatch(
      /alter table public\.meal_plan_meals\s+add column if not exists recipe_id_uuid uuid\s+references public\.recipes\(id\) on delete set null/i,
    );
  });

  it("backfills the new column from the scrubbed text values", () => {
    expect(SQL).toMatch(/update public\.meal_plan_meals[\s\S]*?set recipe_id_uuid = recipe_id::uuid/);
  });

  it("drops the old text column and renames the uuid column into its place", () => {
    expect(SQL).toMatch(/alter table public\.meal_plan_meals drop column recipe_id;/);
    expect(SQL).toMatch(/alter table public\.meal_plan_meals rename column recipe_id_uuid to recipe_id/);
  });

  it("creates a partial index on the new recipe_id column", () => {
    // Partial because placeholder slots have NULL — no point
    // indexing them, and the FK lookup only needs non-null rows.
    expect(SQL).toMatch(
      /create index if not exists meal_plan_meals_recipe_id_idx\s+on public\.meal_plan_meals \(recipe_id\)\s+where recipe_id is not null/i,
    );
  });
});

describe("recipe FK cascade — nutrition_entries.recipe_id addition", () => {
  it("adds nutrition_entries.recipe_id as uuid with FK + SET NULL", () => {
    expect(SQL).toMatch(
      /alter table public\.nutrition_entries\s+add column if not exists recipe_id uuid\s+references public\.recipes\(id\) on delete set null/i,
    );
  });

  it("creates a partial index for the new column", () => {
    expect(SQL).toMatch(
      /create index if not exists nutrition_entries_recipe_id_idx\s+on public\.nutrition_entries \(recipe_id\)\s+where recipe_id is not null/i,
    );
  });
});

describe("recipe FK cascade — save_meal_plan RPC uuid cast", () => {
  it("preserves the existing unauth error (42501)", () => {
    expect(SQL).toMatch(/save_meal_plan: not authenticated/);
    expect(SQL).toMatch(/errcode = '42501'/);
  });

  it("preserves the day-range validation (22023)", () => {
    expect(SQL).toMatch(/day must be in 1\.\.7/);
    expect(SQL).toMatch(/errcode = '22023'/);
  });

  it("preserves the null/non-array plan early-return clear-only semantic", () => {
    expect(SQL).toMatch(/jsonb_typeof\(p_plan\)\s*<>\s*'array'/);
  });

  it("uses a per-row EXCEPTION block to gracefully NULL malformed recipe_ids", () => {
    // The whole point of Phase 1: a stale or malformed `recipe_id`
    // from an old client must not abort the entire plan save. We
    // store NULL on `invalid_text_representation` (22P02) and move
    // on to the next row.
    expect(SQL).toMatch(/v_recipe_id_text\s*::\s*uuid/);
    expect(SQL).toMatch(/exception when invalid_text_representation then[\s\S]*?v_recipe_id_uuid := null;/);
  });

  it("inserts the uuid (not the raw text) into meal_plan_meals.recipe_id", () => {
    // The INSERT must reference the cast variable, NOT the raw JSON
    // text. Otherwise we'd store the original string and Postgres
    // would raise 22P02 at insert time.
    expect(SQL).toMatch(
      /insert into public\.meal_plan_meals[\s\S]*?values \([\s\S]*?v_recipe_id_uuid/,
    );
    // Negative: the old shape `m->>'recipe_id'` directly inside the
    // values list must not appear (it was replaced by the cast
    // variable).
    expect(SQL).not.toMatch(/values\s*\([\s\S]{0,300}m->>'recipe_id'/);
  });

  it("re-grants execute to authenticated (create-or-replace can drop grants)", () => {
    expect(SQL).toMatch(/grant execute on function public\.save_meal_plan\(text, date, jsonb\) to authenticated/i);
  });
});

describe("recipe FK cascade — migration wrapper", () => {
  it("wraps all DDL + RPC changes in a single transaction", () => {
    // Otherwise a partial apply (e.g. scrub succeeds, FK add fails)
    // would leave the schema in a half-migrated state where the
    // text column is gone but the uuid column has no FK.
    expect(SQL.trim().startsWith("-- ") || SQL.includes("begin;")).toBe(true);
    expect(SQL).toMatch(/^begin;/m);
    expect(SQL).toMatch(/^commit;/m);
  });

  it("references the plan doc for traceability", () => {
    expect(SQL).toMatch(/schema-refactor-plan-recipe-fk-cascade\.md/);
  });
});
