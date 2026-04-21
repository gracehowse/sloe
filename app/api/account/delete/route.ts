import { NextResponse } from "next/server";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";
import { assertOrigin } from "@/lib/api/assertOrigin";

/**
 * DELETE /api/account/delete
 *
 * Permanently deletes the authenticated user's account.
 *
 * H3 fix (2026-04-21) — transactional semantics:
 *   Previously the route ran sequential deletes then `auth.admin.deleteUser`
 *   and returned `{ ok: true }` even when intermediate deletes failed
 *   (as long as the auth user itself was deleted), leaving orphaned rows.
 *   Now: if ANY data-delete step fails with a non-ignorable error, we
 *   abort BEFORE deleting the auth user and return 500 with structured
 *   details. The auth.admin.deleteUser call is the final step, gated on
 *   all prior deletes succeeding. Supabase has no cross-table tx
 *   primitive from the JS client, so this is the strongest guarantee
 *   available without a server-side RPC.
 *
 * Requires: Authorization header or session cookie.
 * Requires: SUPABASE_SERVICE_ROLE_KEY (server-side only).
 */
export async function DELETE(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

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

  // Service-role: user-scoped by userId throughout. Every DELETE below filters
  // by the authenticated caller's id (user_id / author_id / reporter_id /
  // follower_id / plan_day_id derived from user_id), so a compromised or
  // missing RLS policy still cannot leak or destroy another user's rows.
  try {
    // 1. meal_plan_meals (needs day IDs)
    const { data: dayRows, error: dayReadErr } = await sb
      .from("meal_plan_days")
      .select("id")
      .eq("user_id", userId);
    if (dayReadErr && !isIgnorable(dayReadErr)) {
      errors.push(`meal_plan_days_read: ${dayReadErr.message}`);
    }
    const dayIds = (dayRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    if (dayIds.length > 0) {
      const { error } = await sb.from("meal_plan_meals").delete().in("plan_day_id", dayIds);
      if (error && !isIgnorable(error)) errors.push(`meal_plan_meals: ${error.message}`);
    }

    // 2. Remaining user-owned tables keyed by user_id / reporter_id / follower_id.
    const tablesToDelete: Array<{ table: string; column: string }> = [
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

    for (const { table, column } of tablesToDelete) {
      const { error } = await sb.from(table).delete().eq(column, userId);
      if (error && !isIgnorable(error)) errors.push(`${table}: ${error.message}`);
    }

    // 3. Private (unpublished) recipes + their ingredients.
    const { data: recipes, error: recReadErr } = await sb
      .from("recipes")
      .select("id")
      .eq("author_id", userId)
      .eq("published", false);
    if (recReadErr && !isIgnorable(recReadErr)) {
      errors.push(`recipes_read: ${recReadErr.message}`);
    }
    const recipeIds = (recipes ?? []).map((r: { id: string }) => r.id);
    if (recipeIds.length > 0) {
      const { error: ingErr } = await sb
        .from("recipe_ingredients")
        .delete()
        .in("recipe_id", recipeIds);
      if (ingErr && !isIgnorable(ingErr)) errors.push(`recipe_ingredients: ${ingErr.message}`);
      const { error: recErr } = await sb.from("recipes").delete().in("id", recipeIds);
      if (recErr && !isIgnorable(recErr)) errors.push(`recipes: ${recErr.message}`);
    }

    // 4. Unattribute published recipes (keep them, remove author link).
    const { error: unattrErr } = await sb
      .from("recipes")
      .update({ author_id: null })
      .eq("author_id", userId);
    if (unattrErr && !isIgnorable(unattrErr)) errors.push(`recipes_unattribute: ${unattrErr.message}`);

    // 5. Legacy JSONB tables.
    for (const table of ["nutrition_journals", "shopping_lists"]) {
      const { error } = await sb.from(table).delete().eq("user_id", userId);
      if (error && !isIgnorable(error)) errors.push(`${table}: ${error.message}`);
    }

    // 6. Profile row.
    const { error: profileErr } = await sb.from("profiles").delete().eq("id", userId);
    if (profileErr) errors.push(`profiles: ${profileErr.message}`);

    // 7. Gate: if any prior step reported a real error, DO NOT delete the
    //    auth user. Returning a 500 lets the client retry idempotently —
    //    all the per-table deletes above are safe to re-run.
    if (errors.length > 0) {
      console.error("[account/delete] Aborting auth deletion — prior errors:", errors);
      return NextResponse.json(
        {
          ok: false,
          error: "deletion_incomplete",
          message:
            "Some account data could not be deleted. The auth user was not removed — retry the request.",
          details: errors,
        },
        { status: 500 },
      );
    }

    // 8. Delete the auth user — last, and only if everything else succeeded.
    const { error: authErr } = await sb.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("[account/delete] auth.admin.deleteUser failed:", authErr.message);
      return NextResponse.json(
        {
          ok: false,
          error: "auth_delete_failed",
          message: authErr.message,
          details: [`auth: ${authErr.message}`],
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = (err as Error)?.message ?? "unknown";
    console.error("[account/delete] Unhandled error:", msg);
    return NextResponse.json(
      {
        ok: false,
        error: "deletion_failed",
        message: msg,
        details: errors.length > 0 ? errors : undefined,
      },
      { status: 500 },
    );
  }
}

function isIgnorable(err: { message: string; code?: string } | null): boolean {
  if (!err) return true;
  const m = String(err.message).toLowerCase();
  const code = String(err.code ?? "");
  if (code === "PGRST205" || code === "42P01") return true;
  return m.includes("could not find the table") || m.includes("does not exist") || m.includes("permission");
}
