import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";
import { scaledMacrosPlausible } from "@/lib/nutrition/verifyIngredients";
import { assertOrigin } from "@/lib/api/assertOrigin";

type SubmitFoodRequest = {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG?: number;
  sugarG?: number;
  sodiumMg?: number;
  servingSizeG?: number;
};

/**
 * GET /api/user-foods?mine=1
 * GET /api/user-foods?q=<query>&limit=10
 *
 * List my barcode contributions, or search the Suppr custom food database.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const url = new URL(req.url);
  const mine = url.searchParams.get("mine") === "1";
  const query = url.searchParams.get("q")?.trim();
  const limit = Math.min(25, Math.max(1, Number(url.searchParams.get("limit")) || 10));

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  if (mine) {
    const { data, error } = await supabase
      .from("user_foods")
      .select("id, barcode, name, brand, verification_status, upvotes, downvotes, created_at, updated_at")
      .eq("submitted_by", userId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ ok: false, error: "list_failed", message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, foods: data ?? [] });
  }

  if (!query || query.length < 2) {
    return NextResponse.json({ ok: false, error: "query_too_short", message: "Search query must be at least 2 characters." }, { status: 400 });
  }

  const searchTerm = `%${query.replace(/[%_]/g, "\\$&")}%`;

  // Service-role: intentionally cross-tenant — user_foods is a shared community
  // barcode/food catalog. Read surface is filtered to verified rows (or pending
  // with >=2 upvotes), so no single submitter's private data is exposed beyond
  // the community contract. Authenticated gate above prevents scraping by
  // anonymous callers.
  const { data, error } = await supabase
    .from("user_foods")
    .select("id, barcode, name, brand, category, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, serving_size_g, verification_status, upvotes, downvotes, source, image_url")
    .or(`verification_status.eq.verified,and(verification_status.eq.pending,upvotes.gte.2)`)
    .ilike("name", searchTerm)
    .order("verification_status", { ascending: true })
    .order("upvotes", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ ok: false, error: "search_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, foods: data ?? [] });
}

/**
 * POST /api/user-foods
 *
 * Submit a new food to the Suppr custom database.
 * Starts as "pending" — becomes searchable after 3+ upvotes or team verification.
 */
export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  // P0-6 (2026-04-25): per-user scoping.
  const rl = await rateLimit({ keyPrefix: "api:user-foods-submit", userId, limit: 20, windowMs: 3600_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many submissions. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const b = body as Partial<SubmitFoodRequest>;

  // Validate required fields
  if (!b.barcode?.trim() || !b.name?.trim()) {
    return NextResponse.json({ ok: false, error: "missing_fields", message: "barcode and name are required." }, { status: 400 });
  }

  const calories = Number(b.calories);
  const protein = Number(b.protein);
  const carbs = Number(b.carbs);
  const fat = Number(b.fat);

  if (!Number.isFinite(calories) || !Number.isFinite(protein) || !Number.isFinite(carbs) || !Number.isFinite(fat)) {
    return NextResponse.json({ ok: false, error: "invalid_macros", message: "calories, protein, carbs, fat must be numbers." }, { status: 400 });
  }

  if (calories < 0 || protein < 0 || carbs < 0 || fat < 0) {
    return NextResponse.json({ ok: false, error: "negative_macros", message: "Macro values cannot be negative." }, { status: 400 });
  }

  // Plausibility check
  const macros = {
    calories,
    protein,
    carbs,
    fat,
    fiberG: Number(b.fiberG) || 0,
    sugarG: Number(b.sugarG) || 0,
    sodiumMg: Number(b.sodiumMg) || 0,
  };

  if (!scaledMacrosPlausible(macros)) {
    return NextResponse.json(
      { ok: false, error: "implausible_macros", message: "Macro values don't pass Atwater sanity check. Please verify the numbers." },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  const { data, error } = await supabase
    .from("user_foods")
    .upsert(
      {
        barcode: b.barcode.trim(),
        name: b.name.trim(),
        brand: b.brand?.trim() || null,
        category: b.category?.trim() || null,
        calories,
        protein,
        carbs,
        fat,
        fiber_g: macros.fiberG,
        sugar_g: macros.sugarG,
        sodium_mg: macros.sodiumMg,
        serving_size_g: Number(b.servingSizeG) || 100,
        submitted_by: userId,
        source: "user",
        verification_status: "pending",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "barcode,submitted_by" },
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: "submit_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id });
}

/**
 * DELETE /api/user-foods?id=<contribution-id>
 *
 * Withdraw one of the caller's barcode contributions from the shared catalog.
 */
export async function DELETE(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });

  const { data: row, error: lookupError } = await supabase
    .from("user_foods")
    .select("id, submitted_by")
    .eq("id", id)
    .eq("submitted_by", userId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ ok: false, error: "lookup_failed", message: lookupError.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("user_foods")
    .delete()
    .eq("id", id)
    .eq("submitted_by", userId);

  if (error) {
    return NextResponse.json({ ok: false, error: "delete_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
