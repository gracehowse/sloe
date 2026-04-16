import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";

type AddMealRequest = {
  dateKey: string;
  mealLabel?: string;
  recipeTitle: string;
  recipeId?: string;
  servings?: number;
  caloriesPerServing?: number;
  proteinPerServing?: number;
  carbsPerServing?: number;
  fatPerServing?: number;
  fiberPerServing?: number;
  notes?: string;
};

/**
 * POST /api/household/meals
 *
 * Add a meal to the household's shared plan.
 */
export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const rl = await rateLimit({ keyPrefix: "api:household-meals", limit: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  // Check membership
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { ok: false, error: "not_in_household", message: "You must be in a household to add meals." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const b = body as Partial<AddMealRequest>;

  if (!b.dateKey || !b.recipeTitle?.trim()) {
    return NextResponse.json(
      { ok: false, error: "missing_fields", message: "dateKey and recipeTitle are required." },
      { status: 400 },
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.dateKey)) {
    return NextResponse.json(
      { ok: false, error: "invalid_date", message: "dateKey must be YYYY-MM-DD format." },
      { status: 400 },
    );
  }

  const { data: meal, error } = await supabase
    .from("household_meals")
    .insert({
      household_id: membership.household_id,
      date_key: b.dateKey,
      meal_label: b.mealLabel?.trim() || "Dinner",
      recipe_title: b.recipeTitle.trim(),
      recipe_id: b.recipeId || null,
      servings: Math.max(1, Math.round(Number(b.servings) || 4)),
      calories_per_serving: Number(b.caloriesPerServing) || null,
      protein_per_serving: Number(b.proteinPerServing) || null,
      carbs_per_serving: Number(b.carbsPerServing) || null,
      fat_per_serving: Number(b.fatPerServing) || null,
      fiber_per_serving: Number(b.fiberPerServing) || null,
      notes: b.notes?.trim() || null,
      added_by: userId,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: "add_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mealId: meal?.id });
}

/**
 * DELETE /api/household/meals?id=<mealId>
 *
 * Remove a meal from the household plan.
 */
export async function DELETE(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  const url = new URL(req.url);
  const mealId = url.searchParams.get("id");
  if (!mealId) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  // RLS handles permission — only creator or owner can delete
  const { error } = await supabase
    .from("household_meals")
    .delete()
    .eq("id", mealId);

  if (error) {
    return NextResponse.json({ ok: false, error: "delete_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
