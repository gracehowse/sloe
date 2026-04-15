import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Phase 1 migration `20260413100000_relational_user_data.sql` renames JSONB tables to `*_legacy`.
 * PostgREST then only exposes `nutrition_entries`, `meal_plan_days`, etc. — callers must try both names.
 */
function missingPhase1JsonTableMessage(msg: string): boolean {
  const m = (msg ?? "").toLowerCase();
  return (
    m.includes("could not find the table") ||
    m.includes("schema cache") ||
    m.includes("does not exist")
  );
}

// ─── Nutrition journal (by_day JSON) ─────────────────────────────────────

export const NUTRITION_JOURNAL_JSON_TABLES = ["nutrition_journals", "nutrition_journals_legacy"] as const;

export async function probeAnyNutritionJournalJsonTable(client: SupabaseClient): Promise<boolean> {
  for (const table of NUTRITION_JOURNAL_JSON_TABLES) {
    const { error } = await client.from(table).select("user_id").limit(1);
    if (!error) return true;
    if (!missingPhase1JsonTableMessage(error.message ?? "")) return false;
  }
  return false;
}

export async function fetchNutritionJournalByDay(
  client: SupabaseClient,
  userId: string,
): Promise<Record<string, unknown> | null> {
  for (const table of NUTRITION_JOURNAL_JSON_TABLES) {
    const { data, error } = await client.from(table).select("by_day").eq("user_id", userId).maybeSingle();
    if (error) {
      if (missingPhase1JsonTableMessage(error.message ?? "")) continue;
      return null;
    }
    if (data?.by_day && typeof data.by_day === "object") {
      return data.by_day as Record<string, unknown>;
    }
  }
  return null;
}

export async function upsertNutritionJournalByDay(
  client: SupabaseClient,
  userId: string,
  by_day: unknown,
): Promise<{ error: { message: string } | null }> {
  const row = { user_id: userId, by_day, updated_at: new Date().toISOString() };
  for (const table of NUTRITION_JOURNAL_JSON_TABLES) {
    const { error } = await client.from(table).upsert(row, { onConflict: "user_id" });
    if (!error) return { error: null };
    if (missingPhase1JsonTableMessage(error.message ?? "")) continue;
    return { error };
  }
  return { error: { message: "No nutrition_journals JSON table in schema" } };
}

// ─── Meal plan (plan JSON) ─────────────────────────────────────────────────

export const MEAL_PLAN_JSON_TABLES = ["meal_plans", "meal_plans_legacy"] as const;

export async function probeAnyMealPlanJsonTable(client: SupabaseClient): Promise<boolean> {
  for (const table of MEAL_PLAN_JSON_TABLES) {
    const { error } = await client.from(table).select("user_id").limit(1);
    if (!error) return true;
    if (!missingPhase1JsonTableMessage(error.message ?? "")) return false;
  }
  return false;
}

/** True if this user has a row in either legacy JSON meal plan table. */
export async function hasUserMealPlanJsonRow(client: SupabaseClient, userId: string): Promise<boolean> {
  for (const table of MEAL_PLAN_JSON_TABLES) {
    const { data, error } = await client.from(table).select("user_id").eq("user_id", userId).maybeSingle();
    if (error) {
      if (missingPhase1JsonTableMessage(error.message ?? "")) continue;
      return false;
    }
    if (data != null) return true;
  }
  return false;
}

export async function fetchMealPlanJson(client: SupabaseClient, userId: string): Promise<unknown | null> {
  for (const table of MEAL_PLAN_JSON_TABLES) {
    const { data, error } = await client.from(table).select("plan").eq("user_id", userId).maybeSingle();
    if (error) {
      if (missingPhase1JsonTableMessage(error.message ?? "")) continue;
      return null;
    }
    if (data?.plan != null) return data.plan;
  }
  return null;
}

export async function upsertMealPlanJson(
  client: SupabaseClient,
  userId: string,
  plan: unknown,
): Promise<{ error: { message: string } | null }> {
  const row = { user_id: userId, plan, updated_at: new Date().toISOString() };
  for (const table of MEAL_PLAN_JSON_TABLES) {
    const { error } = await client.from(table).upsert(row, { onConflict: "user_id" });
    if (!error) return { error: null };
    if (missingPhase1JsonTableMessage(error.message ?? "")) continue;
    return { error };
  }
  return { error: { message: "No meal_plans JSON table in schema" } };
}
