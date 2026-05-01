/**
 * POST /api/recipe-import/caption — share-sheet caption-text recipe import.
 *
 * The mobile share extension sends both `url` and `captionText` (the user-
 * supplied post caption). The server NEVER fetches the URL on this path —
 * the LLM only sees text the user explicitly shared. This is the
 * ToS-immune-by-construction path approved in
 * `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md`.
 *
 * Feature-flag gated: `IG_TT_IMPORT_ENABLED` (default `false`). When OFF,
 * this endpoint returns 404 so callers fall through to the legacy URL
 * importer at `/api/recipe-import`. The flag stays OFF in production
 * until DMCA-agent registration lands.
 *
 * Returns the same recipe shape as `/api/recipe-import` so downstream
 * code (Library, Cook, etc.) consumes it unchanged.
 */

import { NextResponse } from "next/server";
import { isIgTtImportEnabled } from "@/lib/featureFlags/igTtImport";
import { detectSourcePlatform, isCaptionTextPlatform } from "@/lib/recipes/resolveImportUrl";
import { parseCaption, CaptionTooShortError } from "@/lib/recipes/parseCaption";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { verifyIngredients, parseRawIngredients } from "@/lib/nutrition/verifyIngredients";
import { classifyMealType } from "@/lib/recipe-import/classifyMealType";
import { extractCaptionNutrition } from "@/lib/recipe-import/extractCaptionNutrition";
import { normaliseSource } from "@/lib/recipes/persistSourceAttribution";

export const maxDuration = 30;

type Payload = {
  url?: unknown;
  captionText?: unknown;
};

const MIN_CAPTION_LEN = 30;
const MAX_CAPTION_LEN = 8000;

function flagOff() {
  // 404 (not 403) so the mobile fallback logic treats this as "endpoint
  // doesn't exist yet" and routes through the legacy URL importer.
  return NextResponse.json(
    { ok: false, error: "feature_disabled", message: "Caption-text import is not yet enabled." },
    { status: 404 },
  );
}

export async function POST(req: Request) {
  if (!isIgTtImportEnabled()) {
    return flagOff();
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Same per-user budget as the URL importer — caption parsing also burns
  // an OpenAI call.
  const rl = await rateLimit({ keyPrefix: "api:recipe-import:caption", userId, limit: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", message: "Too many imports. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const captionText = typeof body.captionText === "string" ? body.captionText : "";

  if (!url) {
    return NextResponse.json(
      { ok: false, error: "invalid_url", message: "URL is required." },
      { status: 400 },
    );
  }
  const platform = detectSourcePlatform(url);
  if (!isCaptionTextPlatform(platform)) {
    // Blog URLs go through the regular HTML importer.
    return NextResponse.json(
      {
        ok: false,
        error: "wrong_platform",
        message: "This URL doesn't need the caption path. Use /api/recipe-import instead.",
      },
      { status: 400 },
    );
  }

  if (captionText.length > MAX_CAPTION_LEN) {
    return NextResponse.json(
      {
        ok: false,
        error: "caption_too_long",
        message: `Caption exceeds the ${MAX_CAPTION_LEN}-character cap.`,
      },
      { status: 413 },
    );
  }

  const trimmed = captionText.trim();
  if (trimmed.length < MIN_CAPTION_LEN) {
    return NextResponse.json(
      {
        ok: false,
        error: "caption_too_short",
        message:
          "We couldn't read a recipe from the caption you shared. If the post used a video without text, try sharing one with a written caption.",
      },
      { status: 422 },
    );
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "openai_not_configured",
        message: "Set OPENAI_API_KEY to enable caption import.",
      },
      { status: 503 },
    );
  }

  let parsed;
  try {
    parsed = await parseCaption({
      captionText: trimmed,
      sourceUrl: url,
      platform,
      openaiKey,
    });
  } catch (e) {
    if (e instanceof CaptionTooShortError) {
      return NextResponse.json(
        {
          ok: false,
          error: "caption_too_short",
          message:
            "We couldn't read a recipe from the caption you shared. Try sharing a post with a more detailed caption.",
        },
        { status: 422 },
      );
    }
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[recipe-import:caption] parse failed:", msg);
    return NextResponse.json(
      { ok: false, error: "parse_failed", message: "Couldn't extract a recipe from this caption." },
      { status: 502 },
    );
  }

  if (parsed.ingredients.length === 0 && parsed.instructions.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_recipe",
        message:
          "This caption doesn't appear to contain a recipe. Try sharing a different post or paste ingredients manually.",
      },
      { status: 422 },
    );
  }

  const servings = parsed.servings ?? 1;
  const parsedIngs = parseRawIngredients(parsed.ingredients);
  let nutrition: Awaited<ReturnType<typeof verifyIngredients>> | null = null;
  try {
    nutrition = await verifyIngredients({ ingredients: parsedIngs, servings });
  } catch (e) {
    console.error("[recipe-import:caption] verifyIngredients failed:", e instanceof Error ? e.message : e);
  }

  const mealType = classifyMealType({
    title: parsed.title ?? "",
    ingredients: parsed.ingredients,
    caloriesPerServing: nutrition?.perServing.calories ?? null,
    caption: trimmed,
  });

  const attribution = normaliseSource({
    url: parsed.sourceUrl,
    name: parsed.sourceName,
  });

  const ingredientMacros = nutrition
    ? nutrition.verified.map((v) => ({
        name: v.input.name,
        amount: v.resolved.amount,
        unit: v.resolved.unit,
        calories: v.macros?.calories ?? 0,
        protein: v.macros?.protein ?? 0,
        carbs: v.macros?.carbs ?? 0,
        fat: v.macros?.fat ?? 0,
        fiberG: v.macros?.fiberG ?? 0,
        sugarG: v.macros?.sugarG ?? 0,
        sodiumMg: v.macros?.sodiumMg ?? 0,
        source: v.source,
        confidence: v.confidence,
        matchedName: v.matchedName ?? null,
      }))
    : parsedIngs.map((p) => ({
        name: p.name,
        amount: p.amount,
        unit: p.unit,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiberG: 0,
        sugarG: 0,
        sodiumMg: 0,
        source: "Unverified" as const,
        confidence: null,
        matchedName: null,
      }));

  return NextResponse.json({
    ok: true,
    source: platform,
    sourcePlatform: platform,
    recipe: {
      title: parsed.title ?? "Imported recipe",
      description: null,
      ingredients: parsed.ingredients,
      instructions: parsed.instructions,
      servings,
      prepTimeMin: parsed.prepTimeMin,
      cookTimeMin: parsed.cookTimeMin,
      // No imageUrl: we never fetch the post, so no thumbnail. Caller
      // can fall back to a recipe-specific hero or platform glyph.
      imageUrl: null,
      sourceUrl: attribution.source_url,
      sourceName: attribution.source_name,
      sourcePlatform: platform,
      mealType,
      calories: nutrition?.perServing.calories ?? 0,
      protein: nutrition?.perServing.protein ?? 0,
      carbs: nutrition?.perServing.carbs ?? 0,
      fat: nutrition?.perServing.fat ?? 0,
      fiberG: nutrition?.perServing.fiberG ?? 0,
      sugarG: nutrition?.perServing.sugarG ?? 0,
      sodiumMg: nutrition?.perServing.sodiumMg ?? 0,
      ingredientMacros,
      primarySource: nutrition?.primarySource ?? "Unverified",
      captionNutrition: extractCaptionNutrition(trimmed),
    },
  });
}
