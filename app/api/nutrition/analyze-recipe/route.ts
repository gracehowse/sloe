import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { hasEdamamConfig } from "@/lib/server/serverEnv";
import {
  edamamConfigFromEnv,
  edamamNutritionAnalysis,
  edamamAnalysisMacros,
} from "@/lib/edamam/client";

type AnalyzeRequest = {
  ingredientLines: string[];
  servings?: number;
  title?: string;
};

/**
 * POST /api/nutrition/analyze-recipe
 *
 * Uses Edamam Nutrition Analysis API to analyze a full recipe from
 * raw ingredient lines. Returns total and per-serving macros.
 *
 * This provides a second opinion / cross-check alongside the
 * ingredient-by-ingredient USDA pipeline.
 */
export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!hasEdamamConfig()) {
    return NextResponse.json(
      { ok: false, error: "not_configured", message: "Edamam API is not configured on this server." },
      { status: 503 },
    );
  }

  // P0-6 (2026-04-25): per-user scoping.
  const rl = await rateLimit({ keyPrefix: "api:analyze-recipe", userId, limit: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many analysis requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const b = body as Partial<AnalyzeRequest>;
  const ingredientLines = Array.isArray(b.ingredientLines) ? b.ingredientLines.filter((l) => typeof l === "string" && l.trim()) : [];
  const servings = Number.isFinite(b.servings) ? Math.max(1, Math.round(b.servings as number)) : 1;

  if (ingredientLines.length === 0) {
    return NextResponse.json({ ok: false, error: "no_ingredients" }, { status: 400 });
  }
  if (ingredientLines.length > 60) {
    return NextResponse.json({ ok: false, error: "too_many_ingredients", max: 60 }, { status: 400 });
  }

  try {
    const config = edamamConfigFromEnv();
    if (!config) {
      return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
    }

    const analysis = await edamamNutritionAnalysis(config, ingredientLines, { title: b.title });
    if (!analysis) {
      return NextResponse.json(
        { ok: false, error: "analysis_failed", message: "Edamam could not analyze this recipe." },
        { status: 422 },
      );
    }

    const totalMacros = edamamAnalysisMacros(analysis);
    const perServing = {
      calories: Math.round(totalMacros.calories / servings),
      protein: Math.round((totalMacros.protein / servings) * 10) / 10,
      carbs: Math.round((totalMacros.carbs / servings) * 10) / 10,
      fat: Math.round((totalMacros.fat / servings) * 10) / 10,
      fiberG: Math.round((totalMacros.fiberG / servings) * 10) / 10,
      sugarG: Math.round((totalMacros.sugarG / servings) * 10) / 10,
      sodiumMg: Math.round(totalMacros.sodiumMg / servings),
    };

    return NextResponse.json({
      ok: true,
      source: "Edamam",
      totalWeight: Math.round(analysis.totalWeight),
      servings,
      totals: totalMacros,
      perServing,
      ingredients: analysis.ingredients.map((ing) => ({
        food: ing.food,
        quantity: ing.quantity,
        measure: ing.measure,
        weightG: Math.round(ing.weight),
        status: ing.status,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "analysis_failed",
        message: e instanceof Error ? e.message : "Recipe analysis request failed",
      },
      { status: 502 },
    );
  }
}
