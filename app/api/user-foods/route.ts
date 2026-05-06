import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";
import { scaledMacrosPlausible } from "@/lib/nutrition/verifyIngredients";

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
 * GET /api/user-foods?q=<query>&limit=10
 *
 * Search the Suppr custom food database.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();
  const limit = Math.min(25, Math.max(1, Number(url.searchParams.get("limit")) || 10));

  if (!query || query.length < 2) {
    return NextResponse.json({ ok: false, error: "query_too_short", message: "Search query must be at least 2 characters." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
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
