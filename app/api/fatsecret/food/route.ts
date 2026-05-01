import { NextResponse } from "next/server";
import {
  fatSecretConfigFromEnv,
  fatSecretFoodGet,
  type FatSecretServing,
} from "@/lib/fatsecret/client";
import {
  normalizeServingToMacros,
  pickBestServing,
  servingMassGrams,
} from "@/lib/nutrition/fatsecretNormalize";
import { rateLimit } from "@/lib/server/rateLimit";
import { hasFatSecretConfig, misconfiguredFatSecretResponse } from "@/lib/server/serverEnv";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";

/**
 * GET /api/fatsecret/food?foodId=<id>
 *
 * Returns the full per-100g macro panel + selectable portions for a
 * FatSecret food. Mirrors the shape of `/api/usda/food` so the
 * food-search panel can rehydrate a tapped row uniformly.
 *
 * Response shape (success):
 *   {
 *     ok: true,
 *     macrosPer100g: { calories, protein, carbs, fat, fiberG, sugarG, sodiumMg },
 *     portions: FoodPortion[],          // FatSecret named servings + base 'g'
 *     primaryPortion: PrimaryServing | null,
 *   }
 *
 * Per-serving FatSecret rows surface in `/api/fatsecret/search` with a
 * null `macrosPer100g` (we never invent per-100g values on the
 * server). The UI calls THIS route on tap to land the canonical panel
 * before opening the preview.
 *
 * Why not `food.v3`? FatSecret's `food.get` already returns every
 * serving FatSecret has on file (metric + named portions); the
 * normalisers here scale to per 100 g without a Premier-only call.
 */
export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Match /api/usda/food rate limit (60/min/user). Each tap fires one
  // detail request; 60 covers normal scrolling + retries.
  const rl = await rateLimit({
    keyPrefix: "api:fatsecret-food",
    userId,
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { searchParams } = new URL(req.url);
  const foodId = (searchParams.get("foodId") ?? "").trim();
  if (!foodId) {
    return NextResponse.json({ ok: false, error: "missing_food_id" }, { status: 400 });
  }

  if (!hasFatSecretConfig()) {
    const missing = misconfiguredFatSecretResponse();
    if (missing) return missing;
  }

  const cfg = fatSecretConfigFromEnv();

  try {
    const food = await fatSecretFoodGet(cfg, foodId);
    if (!food || !food.servings?.serving) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: "FatSecret returned no servings for this food." },
        { status: 404 },
      );
    }

    const servingNode = food.servings.serving;
    const list: FatSecretServing[] = Array.isArray(servingNode) ? servingNode : [servingNode];

    // Pick the best metric-grounded serving as the basis for per-100g
    // scaling. Same helper used by verifyIngredients.
    const best = pickBestServing(servingNode);
    const perServing = normalizeServingToMacros(best);
    const grams = servingMassGrams(best) ?? 0;

    if (grams <= 0) {
      // No metric grounding — we can't scale to per-100g without it.
      // Surface an honest 404 rather than invent a denominator.
      return NextResponse.json(
        { ok: false, error: "no_metric_serving", message: "FatSecret food has no gram-grounded serving." },
        { status: 422 },
      );
    }

    const factor = 100 / grams;
    const macrosPer100g = {
      calories: Math.max(0, Math.round(perServing.calories * factor)),
      protein: Math.max(0, Math.round(perServing.protein * factor * 10) / 10),
      carbs: Math.max(0, Math.round(perServing.carbs * factor * 10) / 10),
      fat: Math.max(0, Math.round(perServing.fat * factor * 10) / 10),
      fiberG: Math.max(0, Math.round(perServing.fiberG * factor * 10) / 10),
      sugarG: Math.max(0, Math.round(perServing.sugarG * factor * 10) / 10),
      sodiumMg: Math.max(0, Math.round(perServing.sodiumMg * factor)),
    };

    // Build a portion list from FatSecret's serving rows. Each named
    // serving becomes a portion option (e.g. "1 sandwich (240 g)") so
    // the user can pick "1 sandwich" without manually entering grams.
    type PortionOption = { label: string; gramWeight: number; amount: number };
    const portions: PortionOption[] = [];
    const seen = new Set<string>();
    for (const s of list) {
      const g = servingMassGrams(s);
      if (!g || g <= 0) continue;
      const label = (s.serving_description ?? "").trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      portions.push({ label, gramWeight: g, amount: 1 });
    }

    // Primary portion: surface the best metric-grounded serving so the
    // preview defaults to "1 sandwich" rather than "100 g" when the user
    // taps a per-serving FatSecret row.
    const primaryLabel = (best.serving_description ?? "").trim();
    const primaryPortion = primaryLabel && grams > 0
      ? {
          label: primaryLabel,
          grams,
          kcal: perServing.calories,
          protein: Math.round(perServing.protein * 10) / 10,
          carbs: Math.round(perServing.carbs * 10) / 10,
          fat: Math.round(perServing.fat * 10) / 10,
        }
      : null;

    return NextResponse.json({
      ok: true,
      macrosPer100g,
      portions,
      primaryPortion,
    });
  } catch (e) {
    console.error(
      "[/api/fatsecret/food] failed:",
      e instanceof Error ? e.message : e,
    );
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
