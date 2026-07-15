import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";
import { scaledMacrosPlausible } from "@/lib/nutrition/verifyIngredients";
import { assertOrigin } from "@/lib/api/assertOrigin";
import {
  insertCustomFoodWithDedupe,
  type CreateCustomFoodInput,
} from "@/lib/nutrition/customFoodsClient";

/**
 * POST /api/custom-foods  (ENG-1420)
 *
 * Server-enforced create for a user's personal `public.user_custom_foods`
 * row. Manual custom-food creation previously wrote DIRECTLY from the client
 * to Supabase with ZERO plausibility gate — a user could persist e.g. 50 kcal
 * with 40g P + 40g C + 40g F (implied ~700 kcal), violating the project's
 * "reject low-confidence / implausible nutrition" rule. A client-only check
 * would be bypassable; this route makes the gate server-side.
 *
 * Pipeline mirrors `/api/user-foods` POST exactly:
 *   assertOrigin → getUserIdFromRequest (401) → service-role guard (503) →
 *   rateLimit (429) → parse+validate body (400) → scaledMacrosPlausible gate
 *   (422 `implausible_macros`, unless `acknowledgeImplausible: true`) →
 *   service-role insert (dedupe-with-suffix owned server-side).
 *
 * The Atwater 4/4/9 check is basis-agnostic, so it applies directly to the
 * custom food's baseGrams-relative macros with no adaptation. When the caller
 * bypasses a FAILING gate via `acknowledgeImplausible`, the row is stamped
 * `plausibility_overridden = true` so an intentional override is
 * distinguishable from an unguarded gap.
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

  // Per-user scoping. 30/hour is generous for an authenticated personal-data
  // write (lower abuse risk than the shared community `user_foods` table) while
  // still bounding a runaway client or scripted flood.
  const rl = await rateLimit({
    keyPrefix: "api:custom-foods-create",
    userId,
    limit: 30,
    windowMs: 3600_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many custom foods created. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const b = body as Partial<CreateCustomFoodInput>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "missing_fields", message: "name is required." },
      { status: 400 },
    );
  }

  const calories = Number(b.calories);
  const protein = Number(b.protein);
  const carbs = Number(b.carbs);
  const fat = Number(b.fat);
  if (![calories, protein, carbs, fat].every((n) => Number.isFinite(n))) {
    return NextResponse.json(
      { ok: false, error: "invalid_macros", message: "calories, protein, carbs, fat must be numbers." },
      { status: 400 },
    );
  }
  if (calories < 0 || protein < 0 || carbs < 0 || fat < 0) {
    return NextResponse.json(
      { ok: false, error: "negative_macros", message: "Macro values cannot be negative." },
      { status: 400 },
    );
  }

  // Atwater 4/4/9 plausibility gate (the same `scaledMacrosPlausible` the
  // barcode-contribution route uses). Basis-agnostic — runs on the raw
  // baseGrams-relative quadruple.
  const plausible = scaledMacrosPlausible({
    calories,
    protein,
    carbs,
    fat,
    fiberG: Number(b.fiber) || 0,
    sugarG: Number(b.sugarG) || 0,
    sodiumMg: Number(b.sodiumMg) || 0,
  });
  const acknowledged = b.acknowledgeImplausible === true;
  if (!plausible && !acknowledged) {
    return NextResponse.json(
      {
        ok: false,
        error: "implausible_macros",
        message: "Macro values don't pass a basic sanity check. Please double-check the numbers.",
      },
      { status: 422 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  // Whitelist the fields the shared insert helper accepts — never trust the
  // raw body shape. Optional fields pass through only when present so
  // `payloadForInsert`'s "omit when absent" semantics (and its rounding /
  // barcode validation) are preserved unchanged.
  const input: CreateCustomFoodInput = { name, calories, protein, carbs, fat };
  if (typeof b.brand === "string") input.brand = b.brand;
  if (b.baseGrams != null && Number.isFinite(Number(b.baseGrams))) input.baseGrams = Number(b.baseGrams);
  if (b.fiber != null && Number.isFinite(Number(b.fiber))) input.fiber = Number(b.fiber);
  if (Array.isArray(b.servings)) input.servings = b.servings;
  if (b.servingsPerContainer != null && Number.isFinite(Number(b.servingsPerContainer))) {
    input.servingsPerContainer = Number(b.servingsPerContainer);
  }
  if (b.sugarG != null && Number.isFinite(Number(b.sugarG))) input.sugarG = Number(b.sugarG);
  if (b.saturatedFatG != null && Number.isFinite(Number(b.saturatedFatG))) {
    input.saturatedFatG = Number(b.saturatedFatG);
  }
  if (b.sodiumMg != null && Number.isFinite(Number(b.sodiumMg))) input.sodiumMg = Number(b.sodiumMg);
  if (typeof b.barcode === "string") input.barcode = b.barcode;

  try {
    const food = await insertCustomFoodWithDedupe(supabase, userId, input, {
      plausibilityOverridden: !plausible && acknowledged,
    });
    return NextResponse.json({ ok: true, food });
  } catch (err) {
    // `payloadForInsert` throws loudly on a malformed barcode — surface that as
    // a client-actionable 400 rather than a generic 500.
    const message = err instanceof Error ? err.message : "Failed to save custom food.";
    if (/barcode/i.test(message)) {
      return NextResponse.json({ ok: false, error: "invalid_barcode", message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "create_failed", message }, { status: 500 });
  }
}
