import { NextResponse } from "next/server";
import {
  FatSecretTierError,
  fatSecretConfigFromEnv,
  fatSecretFoodCategoriesGet,
  fatSecretTierFromEnv,
} from "@/lib/fatsecret/client";
import { rateLimit } from "@/lib/server/rateLimit";
import { hasFatSecretConfig, misconfiguredFatSecretResponse } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";

/**
 * GET /api/fatsecret/categories
 *
 * Premier-only food-categories endpoint
 * (2026-04-26 — FatSecret Premier Free upgrade).
 *
 * Returns `{ ok: true, tier: "premier", categories: [{ id, name, description }] }`
 * on Premier; an empty `categories: []` on Basic. Useful for filter-
 * chip UI in the food-search panel; clients can hide the row entirely
 * when `categories` is empty.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit({
    keyPrefix: "api:fatsecret-categories",
    userId,
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  if (fatSecretTierFromEnv() !== "premier") {
    return NextResponse.json({ ok: true, tier: "basic", categories: [] });
  }

  if (!hasFatSecretConfig()) {
    const missing = misconfiguredFatSecretResponse();
    if (missing) return missing;
  }

  const cfg = fatSecretConfigFromEnv();
  try {
    const cats = await fatSecretFoodCategoriesGet(cfg);
    return NextResponse.json({
      ok: true,
      tier: "premier",
      categories: cats.map((c) => ({
        id: c.food_category_id,
        name: c.food_category_name,
        description: c.food_category_description ?? null,
      })),
    });
  } catch (e) {
    if (e instanceof FatSecretTierError) {
      return NextResponse.json({ ok: true, tier: "basic", categories: [] });
    }
    return NextResponse.json(
      {
        ok: false,
        error: "fatsecret_failed",
        message: e instanceof Error ? e.message : "FatSecret request failed",
      },
      { status: 502 },
    );
  }
}
