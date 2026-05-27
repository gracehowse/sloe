import { NextResponse } from "next/server";
import { edamamConfigFromEnv, fetchEdamamMicrosPer100g } from "@/lib/edamam/client";
import { rateLimit } from "@/lib/server/rateLimit";
import { hasEdamamConfig } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";

/**
 * GET /api/edamam/food?foodId=<id>
 *
 * ENG-738 (2026-05-26) — on-tap detail fetch for an Edamam search hit.
 * Mirrors `/api/usda/food` (which threads `fdcFoodMicrosPer100g`): the
 * `/parser` search endpoint that `/api/edamam/search` wraps only ships the
 * minimal nutrient block (kcal/protein/fat/carbs/fiber/sugar/sodium). The
 * full per-100g micronutrient panel — fat breakdown, cholesterol, all the
 * vitamins + minerals — lives behind Edamam's `/nutrients` POST endpoint,
 * keyed by `foodId`. We call it here so the meal-detail "Vitamins, minerals
 * & more" surface populates for Edamam-sourced logs.
 *
 * Units already match our canonical `nutrition_micros` keys — values are
 * emitted verbatim, no conversion (see `mapEdamamNutrientsToMicros`).
 *
 * Returns `{ ok: true, microsPer100g }` (object possibly empty when Edamam
 * publishes no extra panel for this food). Never trusts client entitlements;
 * the only thing returned is public nutrition data behind the auth gate +
 * per-user rate limit, same as the USDA detail route.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // P0-6 (2026-04-25) — per-user scoping, same posture as /api/usda/food.
  const rl = await rateLimit({ keyPrefix: "api:edamam-food", userId, limit: 60, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const foodId = (searchParams.get("foodId") ?? "").trim();
  if (!foodId) {
    return NextResponse.json({ ok: false, error: "invalid_foodId" }, { status: 400 });
  }

  if (!hasEdamamConfig()) {
    return NextResponse.json(
      {
        ok: false,
        error: "server_misconfigured",
        message: "EDAMAM_APP_ID and EDAMAM_APP_KEY must be set server-side.",
      },
      { status: 503 },
    );
  }

  const cfg = edamamConfigFromEnv();
  if (!cfg) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 503 });
  }

  try {
    const microsPer100g = await fetchEdamamMicrosPer100g(cfg, foodId);
    return NextResponse.json({
      ok: true,
      foodId,
      ...(Object.keys(microsPer100g).length > 0 ? { microsPer100g } : {}),
    });
  } catch (e) {
    captureRouteError(e, "/api/edamam/food");
    // `fetchEdamamMicrosPer100g` already swallows its own failures and
    // returns {}, so reaching here is unexpected — but keep the merge
    // contract: ok:true + no micros so the client logs the food anyway.
    const includeDiag = process.env.SUPPR_DEBUG === "1";
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/edamam/food] failed:", msg);
    return NextResponse.json({
      ok: true,
      foodId,
      ...(includeDiag ? { _diag: { upstream: "failed", message: msg.slice(0, 200) } } : {}),
    });
  }
}
