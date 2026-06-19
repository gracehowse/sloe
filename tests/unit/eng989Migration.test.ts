import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260615180100_eng989_step_centric_recipes.sql", "utf8");

describe("ENG-989 step-centric recipe migration", () => {
  it("creates relational recipe steps and a nullable ingredient step link", () => {
    expect(sql).toContain("create table if not exists public.recipe_steps");
    expect(sql).toContain("recipe_id uuid not null references public.recipes(id) on delete cascade");
    expect(sql).toContain("add column if not exists step_id uuid references public.recipe_steps(id) on delete set null");
  });

  it("backfills steps from existing newline-delimited instructions without touching ingredients", () => {
    expect(sql).toContain("regexp_split_to_table(coalesce(r.instructions, ''), E'\\n+')");
    expect(sql).toContain("row_number() over (partition by r.id order by ordinality)::integer as position");
    expect(sql).not.toMatch(/drop\s+column\s+instructions/i);
  });
});
