import type { SupabaseClient } from "@supabase/supabase-js";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { upsertShoppingListJsonItems } from "../../../src/lib/supabase/shoppingJsonFallback";
import { upsertNutritionJournalByDay } from "../../../src/lib/supabase/phase1LegacyJsonb";

export type NukeResult = { ok: true } | { ok: false; message: string };

/** PostgREST / Postgres when a table is absent from schema or DB (pre-migration or post-rename). */
function isIgnorableMissingTableError(err: { message: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const m = String(err.message).toLowerCase();
  const code = String(err.code ?? "");
  if (code === "PGRST205" || code === "42P01") return true;
  return m.includes("could not find the table") || m.includes("does not exist");
}

/** Removes structured meal planner rows (days, meals, cached plan JSON). */
export async function clearStructuredMealPlans(supabase: SupabaseClient, userId: string): Promise<NukeResult> {
  try {
    const { data: dayRows, error: dayErr } = await supabase.from("meal_plan_days").select("id").eq("user_id", userId);
    if (dayErr && !isIgnorableMissingTableError(dayErr)) return { ok: false, message: dayErr.message };
    if (!dayErr) {
      const dayIds = (dayRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
      if (dayIds.length > 0) {
        const { error: mmErr } = await supabase.from("meal_plan_meals").delete().in("plan_day_id", dayIds);
        if (mmErr && !isIgnorableMissingTableError(mmErr)) return { ok: false, message: mmErr.message };
      }
      const { error: dErr } = await supabase.from("meal_plan_days").delete().eq("user_id", userId);
      if (dErr && !isIgnorableMissingTableError(dErr)) return { ok: false, message: dErr.message };
    }
    // Phase 1 migration renames `meal_plans` → `meal_plans_legacy`; wipe whichever exists.
    const { error: pErr } = await supabase.from("meal_plans").delete().eq("user_id", userId);
    if (pErr && !isIgnorableMissingTableError(pErr)) return { ok: false, message: pErr.message };
    const { error: legacyErr } = await supabase.from("meal_plans_legacy").delete().eq("user_id", userId);
    if (legacyErr && !isIgnorableMissingTableError(legacyErr)) return { ok: false, message: legacyErr.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unknown error" };
  }
}

/**
 * Permanently deletes app-owned rows for this user (journal, plans, library links,
 * shopping, private recipes) and resets `profiles` nutrition / activity JSON to a clean slate.
 * Does not delete the auth user, promo redemptions, or change `user_tier`.
 */
export async function nukeAllUserAppData(supabase: SupabaseClient, userId: string): Promise<NukeResult> {
  try {
    const cleared = await clearStructuredMealPlans(supabase, userId);
    if (!cleared.ok) return cleared;

    const ops: PromiseLike<{ error: { message: string } | null }>[] = [
      supabase.from("shopping_items").delete().eq("user_id", userId),
      supabase.from("nutrition_entries").delete().eq("user_id", userId),
      supabase.from("saves").delete().eq("user_id", userId),
      supabase.from("app_notifications").delete().eq("user_id", userId),
      supabase.from("creator_publish_notifications").delete().eq("user_id", userId),
      supabase.from("recipe_plan_add_events").delete().eq("user_id", userId),
    ];

    await Promise.all(ops);

    const { error: reportsErr } = await supabase.from("food_reports").delete().eq("reporter_id", userId);
    const ignorableReports =
      isIgnorableMissingTableError(reportsErr) ||
      String(reportsErr?.message ?? "").toLowerCase().includes("permission");
    if (reportsErr && !ignorableReports) {
      return { ok: false, message: reportsErr.message };
    }

    const { data: privateRecipes, error: prErr } = await supabase
      .from("recipes")
      .select("id")
      .eq("author_id", userId)
      .eq("published", false);
    if (prErr) return { ok: false, message: prErr.message };
    const recipeIds = (privateRecipes ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    if (recipeIds.length > 0) {
      const { error: ingErr } = await supabase.from("recipe_ingredients").delete().in("recipe_id", recipeIds);
      if (ingErr) return { ok: false, message: ingErr.message };
      const { error: recErr } = await supabase.from("recipes").delete().in("id", recipeIds);
      if (recErr) return { ok: false, message: recErr.message };
    }

    const { error: listErr } = await upsertShoppingListJsonItems(supabase, userId, []);
    if (listErr) {
      const msg = String(listErr.message ?? "").toLowerCase();
      const ignorable =
        isIgnorableMissingTableError(listErr) || msg.includes("no shopping_lists json table");
      if (!ignorable) return { ok: false, message: listErr.message };
    }

    const { error: journalErr } = await upsertNutritionJournalByDay(supabase, userId, {});
    if (journalErr) {
      const msg = String(journalErr.message ?? "").toLowerCase();
      const ignorable =
        isIgnorableMissingTableError(journalErr) || msg.includes("no nutrition_journals json table");
      if (!ignorable) return { ok: false, message: journalErr.message };
    }

    const { error: profErr } = await supabase
      .from("profiles")
      .update({
        target_calories: NUTRITION_DEFAULTS.calories,
        target_protein: NUTRITION_DEFAULTS.protein,
        target_carbs: NUTRITION_DEFAULTS.carbs,
        target_fat: NUTRITION_DEFAULTS.fat,
        target_fiber_g: NUTRITION_DEFAULTS.fiber,
        target_water_ml: NUTRITION_DEFAULTS.water,
        onboarding_completed: false,
        steps_by_day: {},
        activity_burn_by_day: {},
        basal_burn_by_day: {},
        workouts_by_day: {},
        extra_water_by_day: {},
        weight_kg_by_day: {},
        adaptive_tdee: null,
        adaptive_tdee_confidence: null,
        adaptive_tdee_updated_at: null,
        fasting_sessions: [],
        fasting_enabled: false,
        fasting_window: null,
        prefer_activity_adjusted_calories: false,
        daily_steps_goal: NUTRITION_DEFAULTS.steps,
        tracked_macros: ["protein", "carbs", "fat"],
        week_start_day: "monday",
        weight_kg: null,
        height_cm: null,
        sex: null,
        dob: null,
        age: null,
        goal: null,
        goal_weight_kg: null,
        activity_level: null,
        dietary: null,
        display_name: null,
        body_fat_pct: null,
        calorie_schedule: null,
        high_days: null,
        nutrition_strategy: null,
        plan_pace: null,
      })
      .eq("id", userId);
    if (profErr) return { ok: false, message: profErr.message };

    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unknown error" };
  }
}
