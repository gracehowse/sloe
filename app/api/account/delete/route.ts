import { NextResponse } from "next/server";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";

/**
 * DELETE /api/account/delete
 *
 * Permanently deletes the authenticated user's account:
 * 1. Deletes all user-owned rows across tables (via RLS DELETE policies)
 * 2. Deletes the profile row
 * 3. Deletes the Supabase Auth user
 *
 * Requires: Authorization header or session cookie.
 * Requires: SUPABASE_SERVICE_ROLE_KEY (server-side only).
 */
export async function DELETE(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const sb = createSupabaseServiceRoleClient();
  if (!sb) {
    return NextResponse.json(
      { ok: false, error: "Account deletion unavailable — service key not configured" },
      { status: 503 },
    );
  }

  const errors: string[] = [];

  // Delete user-owned data across all tables.
  // Order matters: delete child rows before parent rows.
  const tablesToDelete = [
    { table: "meal_plan_meals", via: "plan_day_id", nested: true },
    { table: "meal_plan_days", column: "user_id" },
    { table: "meal_plans", column: "user_id" },
    { table: "meal_plans_legacy", column: "user_id" },
    { table: "shopping_items", column: "user_id" },
    { table: "nutrition_entries", column: "user_id" },
    { table: "saves", column: "user_id" },
    { table: "app_notifications", column: "user_id" },
    { table: "creator_publish_notifications", column: "user_id" },
    { table: "recipe_plan_add_events", column: "user_id" },
    { table: "food_reports", column: "reporter_id" },
    { table: "author_follows", column: "follower_id" },
  ];

  // First handle meal_plan_meals (needs day IDs)
  const { data: dayRows } = await sb.from("meal_plan_days").select("id").eq("user_id", userId);
  const dayIds = (dayRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
  if (dayIds.length > 0) {
    const { error } = await sb.from("meal_plan_meals").delete().in("plan_day_id", dayIds);
    if (error && !isIgnorable(error)) errors.push(`meal_plan_meals: ${error.message}`);
  }

  // Delete from remaining tables
  for (const { table, column, nested } of tablesToDelete) {
    if (nested) continue; // already handled above
    if (!column) continue;
    const { error } = await sb.from(table).delete().eq(column, userId);
    if (error && !isIgnorable(error)) errors.push(`${table}: ${error.message}`);
  }

  // Delete user's private (unpublished) recipes and their ingredients
  const { data: recipes } = await sb
    .from("recipes")
    .select("id")
    .eq("author_id", userId)
    .eq("published", false);
  const recipeIds = (recipes ?? []).map((r: { id: string }) => r.id);
  if (recipeIds.length > 0) {
    await sb.from("recipe_ingredients").delete().in("recipe_id", recipeIds);
    await sb.from("recipes").delete().in("id", recipeIds);
  }

  // Unattribute published recipes (keep them but remove author link)
  await sb.from("recipes").update({ author_id: null }).eq("author_id", userId);

  // Delete nutrition journals and shopping lists (legacy JSONB)
  for (const table of ["nutrition_journals", "shopping_lists"]) {
    const { error } = await sb.from(table).delete().eq("user_id", userId);
    if (error && !isIgnorable(error)) errors.push(`${table}: ${error.message}`);
  }

  // Delete profile row
  const { error: profileErr } = await sb.from("profiles").delete().eq("id", userId);
  if (profileErr) errors.push(`profiles: ${profileErr.message}`);

  // Delete the auth user (this is the critical step)
  const { error: authErr } = await sb.auth.admin.deleteUser(userId);
  if (authErr) errors.push(`auth: ${authErr.message}`);

  if (errors.length > 0) {
    console.error("[account/delete] Partial deletion errors:", errors);
    // Still return success if auth user was deleted — data will be orphaned but inaccessible
    if (authErr) {
      return NextResponse.json({ ok: false, error: "Account deletion failed", details: errors }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

function isIgnorable(err: { message: string; code?: string } | null): boolean {
  if (!err) return true;
  const m = String(err.message).toLowerCase();
  const code = String(err.code ?? "");
  if (code === "PGRST205" || code === "42P01") return true;
  return m.includes("could not find the table") || m.includes("does not exist") || m.includes("permission");
}
