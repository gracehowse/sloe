import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { verifyIngredients, type IngredientOverride } from "@/lib/nutrition/verifyIngredients";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";

type VerifyRequest = {
  ingredients: { name: string; amount: string; unit: string }[];
  servings: number;
  provider?: "auto" | "fatsecret" | "usda";
  overrides?: IngredientOverride[];
};

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // P0-6 (2026-04-25): per-user scoping.
  const rl = await rateLimit({ keyPrefix: "api:verify-recipe", userId, limit: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many verification requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const b = body as Partial<VerifyRequest>;
  const ingredients = Array.isArray(b.ingredients) ? b.ingredients : [];
  const servings = Number.isFinite(b.servings) ? Math.max(1, Math.round(b.servings as number)) : 1;
  const provider = b.provider ?? "auto";
  const overrides = Array.isArray(b.overrides) ? b.overrides : [];

  if (ingredients.length === 0) {
    return NextResponse.json({ ok: false, error: "no_ingredients" }, { status: 400 });
  }
  if (ingredients.length > 60) {
    return NextResponse.json({ ok: false, error: "too_many_ingredients", max: 60 }, { status: 400 });
  }

  // 2026-05-16 (ENG-553): wall-time on the recipe-import critical path
  // so we can MEASURE the ENG-553 (verify-ingredients concurrency 4→8)
  // bump in production. Reported on both success + failure paths.
  const verifyStartedAt = Date.now();
  try {
    const result = await verifyIngredients({ ingredients, servings, provider, overrides });
    const confidenceTier =
      result.avgIngredientConfidence >= 0.75
        ? "high"
        : result.avgIngredientConfidence >= 0.5
          ? "medium"
          : "low";
    return NextResponse.json({
      ok: true,
      confidenceTier,
      verifyDurationMs: Date.now() - verifyStartedAt,
      ingredientCount: ingredients.length,
      ...result,
    });
  } catch (e) {
    captureRouteError(e, "/api/nutrition/verify-recipe", {
      provider,
      ingredientCount: ingredients.length,
      verifyDurationMs: Date.now() - verifyStartedAt,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "verify_failed",
        provider,
        verifyDurationMs: Date.now() - verifyStartedAt,
        ingredientCount: ingredients.length,
        message: e instanceof Error ? e.message : "Verification request failed",
      },
      { status: 502 },
    );
  }
}
