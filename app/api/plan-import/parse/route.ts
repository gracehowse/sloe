import { NextResponse } from "next/server";
import { AiBudgetExceededError, callAiText } from "@/lib/server/aiProvider";
import { rateLimit } from "@/lib/server/rateLimit";
import { acceptedLineCount, verifyIngredients } from "@/lib/nutrition/verifyIngredients";
import { recipeConfidenceTierWithExclusions } from "@/lib/nutrition/verifyConfidencePolicy";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { buildPlanImportParsePrompt } from "@/lib/planning/planImport/parsePlanImportPrompt";
import { normalizeLlmPayload } from "@/lib/planning/planImport/normalizeLlmPayload";
import {
  compilePlanImportSlots,
  ingredientRowsFromRecipe,
  planImportStats,
} from "@/lib/planning/planImport/compilePlanImport";
import type {
  PlanImportConfidence,
  PlanImportParsedRecipe,
  PlanImportVerifiedRecipe,
} from "@/lib/planning/planImport/types";
import { assertOrigin } from "@/lib/api/assertOrigin";

export const runtime = "nodejs";

const MAX_TEXT_LEN = 64_000;
const MAX_RECIPES = 40;

function confidenceFromTier(tier: string): PlanImportConfidence {
  if (tier === "high") return "high";
  if (tier === "medium") return "medium";
  return "low";
}

async function verifyRecipe(recipe: PlanImportParsedRecipe): Promise<PlanImportVerifiedRecipe> {
  const rows = ingredientRowsFromRecipe(recipe);
  if (rows.length === 0) {
    const author = recipe.authorNutrition;
    return {
      ...recipe,
      supprNutrition: {
        calories: Math.round(author?.calories ?? 0),
        protein: author?.protein ?? 0,
        carbs: author?.carbs ?? 0,
        fat: author?.fat ?? 0,
        fiberG: author?.fiberG ?? 0,
      },
      confidence: "low",
      confidenceTier: "low",
      ingredientCount: 0,
      excludedLineCount: 0,
    };
  }
  const result = await verifyIngredients({
    ingredients: rows,
    servings: recipe.serves,
    provider: "auto",
  });
  // ENG-1422 — cap the displayed tier on excluded lines so a more incomplete
  // recipe can't read at a higher confidence than a fully-matched one.
  const tier = recipeConfidenceTierWithExclusions(
    result.avgIngredientConfidence,
    result.belowAcceptFloorCount,
    acceptedLineCount(result),
  );
  const ingredientMacros = result.verified.map((v) => ({
    name: v.input.name,
    amount: v.input.amount,
    unit: v.input.unit,
    calories: Math.round(v.macros?.calories ?? 0),
    protein: Math.round((v.macros?.protein ?? 0) * 10) / 10,
    carbs: Math.round((v.macros?.carbs ?? 0) * 10) / 10,
    fat: Math.round((v.macros?.fat ?? 0) * 10) / 10,
    fiberG: Math.round((v.macros?.fiberG ?? 0) * 10) / 10,
    source: v.source,
    confidence: v.confidence,
    // ENG-1276 — forward the matched food id so the persist layer can store
    // it + derive matched_alias_key (dropped before).
    fatsecretFoodId: v.fatSecretFoodId ?? null,
  }));
  return {
    ...recipe,
    supprNutrition: {
      calories: Math.round(result.perServing.calories),
      protein: Math.round(result.perServing.protein * 10) / 10,
      carbs: Math.round(result.perServing.carbs * 10) / 10,
      fat: Math.round(result.perServing.fat * 10) / 10,
      fiberG: Math.round((result.perServing.fiberG ?? 0) * 10) / 10,
    },
    confidence: confidenceFromTier(tier),
    confidenceTier: confidenceFromTier(tier),
    ingredientCount: rows.length,
    excludedLineCount: result.belowAcceptFloorCount,
    ingredientMacros,
  };
}

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  if (await isServerFeatureEnabled("kill_plan_import")) {
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message: "Plan import is temporarily unavailable. Try again shortly.",
        retryAfterSec: 300,
      },
      { status: 503, headers: { "Retry-After": "300" } },
    );
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit({
    keyPrefix: "api:plan-import-parse",
    userId,
    limit: 20,
    windowMs: 24 * 60 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { text?: string; planName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "missing_text" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LEN) {
    return NextResponse.json(
      { ok: false, error: "text_too_long", max: MAX_TEXT_LEN },
      { status: 400 },
    );
  }

  let aiResult;
  try {
    aiResult = await callAiText({
      callSite: "plan-import-parse",
      userId,
      userText: buildPlanImportParsePrompt(text),
      expectJson: true,
      temperature: 0.2,
      maxTokens: 8000,
    });
  } catch (err) {
    if (err instanceof AiBudgetExceededError) {
      return NextResponse.json(
        {
          ok: false,
          error: "ai_capacity_reached",
          message: "AI is temporarily at capacity. Try again in a few hours.",
          retryAfterSec: err.retryAfterSec,
        },
        { status: 503, headers: { "Retry-After": String(err.retryAfterSec) } },
      );
    }
    captureRouteError(err, "/api/plan-import/parse", { stage: "llm" });
    throw err;
  }

  if (!aiResult.ok) {
    return NextResponse.json(
      { ok: false, error: aiResult.error, message: aiResult.message },
      { status: aiResult.status },
    );
  }

  let parsedRaw: unknown;
  try {
    const cleaned = aiResult.text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    parsedRaw = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { ok: false, error: "unparseable_model_output", message: "Could not read the plan format. Try a clearer paste." },
      { status: 502 },
    );
  }

  const normalized = normalizeLlmPayload(parsedRaw);
  const planName =
    (body.planName?.trim() || normalized.planName?.trim() || "Imported plan").slice(0, 80);

  if (normalized.recipes.length === 0 && normalized.schedule.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_content_parsed",
        message: "No recipes or schedule found. Paste must include recipe ingredients, not just dish names.",
      },
      { status: 422 },
    );
  }

  const recipesToVerify = normalized.recipes.slice(0, MAX_RECIPES);
  const verified: PlanImportVerifiedRecipe[] = [];
  for (const r of recipesToVerify) {
    try {
      verified.push(await verifyRecipe(r));
    } catch (err) {
      captureRouteError(err, "/api/plan-import/parse", { stage: "verify", recipe: r.key });
      verified.push({
        ...r,
        supprNutrition: {
          calories: Math.round(r.authorNutrition?.calories ?? 0),
          protein: r.authorNutrition?.protein ?? 0,
          carbs: r.authorNutrition?.carbs ?? 0,
          fat: r.authorNutrition?.fat ?? 0,
          fiberG: r.authorNutrition?.fiberG ?? 0,
        },
        confidence: "low",
        confidenceTier: "low",
        ingredientCount: r.ingredients.length,
        excludedLineCount: 0,
      });
    }
  }

  const slots = compilePlanImportSlots({
    schedule: normalized.schedule,
    recipes: verified,
  });
  const stats = planImportStats(slots, verified);

  return NextResponse.json({
    ok: true,
    planName,
    recipes: verified,
    slots,
    stats,
  });
}
