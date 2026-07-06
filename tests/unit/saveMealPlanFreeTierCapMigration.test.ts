import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { FREE_TIER_PLAN_CAP_MESSAGE_FRAGMENT } from "../../src/lib/mealPlan/planPersistError";

/**
 * ENG-1387 — pin the free-tier day-cap migration shape.
 *
 * Live behaviour needs a Supabase instance; this file pins the
 * migration source so a refactor that accidentally drops the tier
 * gate, the search_path pin, or the preserved 20260511 semantics
 * fails CI. Mirrors `saveMealPlanRpcMigration.test.ts` (which pins
 * the original 20260503 contract — still valid for that file).
 */

const SQL = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260706090000_eng1387_save_meal_plan_free_tier_day_cap.sql",
  ),
  "utf-8",
);

describe("save_meal_plan free-tier day-cap migration shape", () => {
  it("declares the function with the unchanged signature", () => {
    expect(SQL).toMatch(
      /create or replace function public\.save_meal_plan\s*\(\s*p_slot_id text,\s*p_start_date date,\s*p_plan jsonb\s*\)/i,
    );
  });

  it("stays SECURITY INVOKER so RLS policies still apply", () => {
    expect(SQL).toMatch(/security invoker/i);
    // The tier helper is referenced in comments; the function itself
    // must not be declared definer.
    expect(SQL).not.toMatch(/^\s*security definer/im);
  });

  it("re-declares the search_path pin (CREATE OR REPLACE wipes the 20260516 ALTER)", () => {
    expect(SQL).toMatch(/set search_path = public, pg_temp/);
  });

  it("gates free-tier callers via the shared RLS helper, not a raw subquery", () => {
    expect(SQL).toMatch(/public\.auth_profile_user_tier\(\)\s*=\s*'free'/);
    expect(SQL).not.toMatch(/select user_tier from public\.profiles/i);
  });

  it("rejects free-tier days > 1 with 42501 and the exact client-matched fragment", () => {
    // The web toast + mobile alert match on this fragment
    // (src/lib/mealPlan/planPersistError.ts). If it drifts here, the
    // clients go silent again — this assertion locks the contract.
    expect(SQL).toContain(FREE_TIER_PLAN_CAP_MESSAGE_FRAGMENT);
    const raiseIdx = SQL.indexOf(FREE_TIER_PLAN_CAP_MESSAGE_FRAGMENT);
    const after = SQL.slice(raiseIdx, raiseIdx + 200);
    expect(after).toMatch(/42501/);
    expect(SQL).toMatch(/v_is_free and v_day_num > 1/);
  });

  it("raises the cap before inserting the offending day row", () => {
    const gateIdx = SQL.indexOf("v_is_free and v_day_num > 1");
    const insertIdx = SQL.toLowerCase().indexOf("insert into public.meal_plan_days");
    expect(gateIdx).toBeGreaterThan(0);
    expect(insertIdx).toBeGreaterThan(gateIdx);
  });

  it("falls back to the 'default' slot on null p_slot_id (ENG-1388 half-fix)", () => {
    expect(SQL).toMatch(/coalesce\(p_slot_id, 'default'\)/);
    // Both the DELETE and the day INSERT must use the coalesced slot.
    expect(SQL).toMatch(/where user_id = v_user_id and slot_id = v_slot_id/);
    expect(SQL).toMatch(
      /insert into public\.meal_plan_days[\s\S]{0,120}values \(v_user_id, v_slot_id/i,
    );
  });

  it("keeps the unauth guard, day-range check, and atomic replace", () => {
    expect(SQL).toMatch(/save_meal_plan: not authenticated/);
    expect(SQL).toMatch(/day must be in 1\.\.7/);
    expect(SQL).toMatch(/22023/);
    const deleteCount = (SQL.match(/delete from public\.meal_plan_days/gi) ?? []).length;
    expect(deleteCount).toBe(1);
    const deleteIdx = SQL.toLowerCase().indexOf("delete from public.meal_plan_days");
    const insertIdx = SQL.toLowerCase().indexOf("insert into public.meal_plan_days");
    expect(insertIdx).toBeGreaterThan(deleteIdx);
  });

  it("preserves the 20260511 per-row recipe_id uuid cast with NULL fallback", () => {
    expect(SQL).toMatch(/v_recipe_id_text::uuid/);
    expect(SQL).toMatch(/invalid_text_representation/);
  });

  it("keeps authenticated execute and drops the anon/PUBLIC surface", () => {
    expect(SQL).toMatch(
      /grant execute on function public\.save_meal_plan\(text, date, jsonb\) to authenticated/i,
    );
    expect(SQL).toMatch(
      /revoke execute on function public\.save_meal_plan\(text, date, jsonb\) from public, anon/i,
    );
  });

  it("reloads the PostgREST schema cache", () => {
    expect(SQL).toMatch(/notify pgrst, 'reload schema'/);
  });
});
