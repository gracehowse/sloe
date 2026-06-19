import { NextResponse } from "next/server";
import { edamamConfigFromEnv, fetchEdamamMicrosPer100g } from "@/lib/edamam/client";
import { rateLimit } from "@/lib/server/rateLimit";
import { hasEdamamConfig } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import {
  checkQuota,
  consumeQuota,
  getCachedDetail,
  setCachedDetail,
} from "@/lib/server/vendorSearchCache";

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
 *
 * ENG-1117 — the `/nutrients` detail call counts against Edamam's SAME
 * account-wide 1,000/day free-tier ceiling as `/api/edamam/search`. Before
 * this fix the on-tap detail fetch was UNGUARDED: a few hundred concurrent
 * tappers could blow the daily cap via detail fetches alone, after which ALL
 * Edamam search degraded for everyone. We now share the search route's two
 * mechanisms: a per-foodId detail cache (repeat taps of the same food never
 * re-spend quota) + the account-level quota guard (consume on a real call,
 * skip + return the same degraded envelope shape when over).
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

  // ENG-1117 — 1) per-foodId cache hit: serve the stored micro panel without
  // an Edamam `/nutrients` call and without spending quota. Repeat on-tap
  // detail fetches of the same food are free.
  const cached = await getCachedDetail<{ microsPer100g?: Record<string, number> }>("edamam", foodId);
  if (cached) {
    return NextResponse.json({
      ok: true,
      foodId,
      ...(cached.microsPer100g && Object.keys(cached.microsPer100g).length > 0
        ? { microsPer100g: cached.microsPer100g }
        : {}),
      cached: true,
    });
  }

  // ENG-1117 — 2) account-wide quota exhausted: skip the vendor and return the
  // SAME degraded envelope shape `/api/edamam/search` uses, so the client
  // surfaces an honest notice instead of an unguarded vendor call.
  const quota = await checkQuota("edamam");
  if (!quota.allowed) {
    return NextResponse.json({
      ok: true,
      foodId,
      degraded: true,
      degradedReason: "quota_exhausted",
    });
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
    // ENG-1117 — consume one quota unit immediately before the live call
    // (atomic INCR, same as the search route). This is the real spend.
    await consumeQuota("edamam");
    const microsPer100g = await fetchEdamamMicrosPer100g(cfg, foodId);
    const hasMicros = Object.keys(microsPer100g).length > 0;
    // Cache only the genuine successful response so a repeat tap is free. An
    // empty panel IS a stable fact worth caching (Edamam publishes nothing
    // extra for this food) — but the catch block below must NOT be cached.
    await setCachedDetail("edamam", foodId, { microsPer100g });
    return NextResponse.json({
      ok: true,
      foodId,
      ...(hasMicros ? { microsPer100g } : {}),
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
