import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * T15 (full-sweep 2026-04-24) — pin the save_meal_plan RPC migration
 * shape. Live behaviour is exercised in the manual / integration test
 * harness (requires a Supabase instance); this file pins the migration
 * source so a refactor that accidentally breaks the contract fails CI.
 */

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260503100400_save_meal_plan_rpc.sql"),
  "utf-8",
);

describe("save_meal_plan RPC migration shape", () => {
  it("declares the function with the expected signature", () => {
    expect(SQL).toMatch(
      /create or replace function public\.save_meal_plan\s*\(\s*p_slot_id text,\s*p_start_date date,\s*p_plan jsonb\s*\)/i,
    );
  });

  it("uses SECURITY INVOKER so RLS policies still apply", () => {
    expect(SQL).toMatch(/security invoker/i);
    expect(SQL).not.toMatch(/security definer/i);
  });

  it("rejects unauthenticated callers with 42501", () => {
    expect(SQL).toMatch(/auth\.uid\(\)/);
    expect(SQL).toMatch(/42501/);
  });

  it("does the replace as DELETE + iteration in one function body (atomic)", () => {
    // The whole function body is one statement transaction; this pins
    // that the DELETE precedes any INSERT and that there is exactly
    // one DELETE call (no second pass).
    const deleteCount = (SQL.match(/delete from public\.meal_plan_days/gi) ?? []).length;
    expect(deleteCount).toBe(1);
    const deleteIdx = SQL.toLowerCase().indexOf("delete from public.meal_plan_days");
    const insertIdx = SQL.toLowerCase().indexOf("insert into public.meal_plan_days");
    expect(deleteIdx).toBeGreaterThan(0);
    expect(insertIdx).toBeGreaterThan(deleteIdx);
  });

  it("validates day ∈ 1..7 with code 22023", () => {
    expect(SQL).toMatch(/day must be in 1\.\.7/);
    expect(SQL).toMatch(/22023/);
  });

  it("inserts into meal_plan_days with start_date (T7 anchor)", () => {
    expect(SQL).toMatch(
      /insert into public\.meal_plan_days[\s\S]*?start_date/i,
    );
  });

  it("inserts the meal payload with all macro + portion + placeholder columns", () => {
    expect(SQL).toMatch(/insert into public\.meal_plan_meals[\s\S]*?slot_index[\s\S]*?recipe_title[\s\S]*?recipe_id[\s\S]*?calories[\s\S]*?protein[\s\S]*?carbs[\s\S]*?fat[\s\S]*?portion_multiplier[\s\S]*?is_placeholder/i);
  });

  it("treats null / non-array p_plan as a clear-only operation", () => {
    expect(SQL).toMatch(/jsonb_typeof\(p_plan\)\s*<>\s*'array'/);
  });

  it("grants execute to authenticated", () => {
    expect(SQL).toMatch(
      /grant execute on function public\.save_meal_plan\(text, date, jsonb\) to authenticated/i,
    );
  });
});
