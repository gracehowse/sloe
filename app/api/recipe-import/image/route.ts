import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { verifyIngredients, parseRawIngredients } from "@/lib/nutrition/verifyIngredients";
import { importErrorResponse } from "@/lib/recipes/importErrorCopy";
import { sanitiseImportedTitle } from "@/lib/recipe-import/extractSocialRecipe";
import { AiBudgetExceededError, callAiVision, activeVendor } from "@/lib/server/aiProvider";
import { normalizeImageForAi } from "@/lib/server/normalizeImageForAi";
import { normaliseSource } from "@/lib/recipes/persistSourceAttribution";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import {
  traceExtraction,
  traceParsing,
  traceNutritionLookup,
} from "@/lib/analytics/recipeImportPipelineTrace";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Image → ingredient lines via Claude vision (Anthropic, default) or
 * OpenAI vision fallback. 2026-05-08 migration:
 * `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`.
 */
export async function POST(req: Request) {
  // 2026-05-16 (ENG-519) — shared kill switch with the URL + caption
  // import paths (`kill_recipe_import`).
  if (await isServerFeatureEnabled("kill_recipe_import")) {
    return NextResponse.json(
      { ...importErrorResponse("service_unavailable"), retryAfterSec: 300 },
      { status: 503, headers: { "Retry-After": "300" } },
    );
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(importErrorResponse("unauthorized"), { status: 401 });
  }

  const tier = await getUserTier(userId);
  if (tier === "free") {
    return NextResponse.json(importErrorResponse("pro_required"), { status: 403 });
  }

  // P0-6 (2026-04-25): per-user scoping; renamed prefix for parity.
  const limited = await rateLimit({ keyPrefix: "api:recipe-import-image", userId, limit: 15, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ...importErrorResponse("rate_limited"), retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  if (!activeVendor()) {
    return NextResponse.json(importErrorResponse("openai_not_configured"), { status: 503 });
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(importErrorResponse("expected_multipart"), { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(importErrorResponse("invalid_body"), { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json(importErrorResponse("missing_image"), { status: 400 });
  }

  // F-156-recipe-wave (2026-05-10): the image-import path previously
  // had no way to capture the original recipe URL — saved rows had
  // null `source_url` so the recipe-detail screen rendered no
  // attribution and the source-card link wasn't tappable. Two related
  // tester reports ("Imported recipes lose source link" + "Esther Clark
  // recipe — source not clickable") collapse to the same root: image
  // imports never wrote a source URL. The client now sends an
  // optional `sourceUrl` text field alongside the image; we run it
  // through the existing `normaliseSource` helper (same path as the
  // URL-import branch) so persistence + render are uniform across
  // import sources. Empty / invalid URL silently falls through —
  // previous "no attribution" behaviour is preserved.
  const rawSourceUrlField = form.get("sourceUrl");
  const sourceUrlInput =
    typeof rawSourceUrlField === "string" && rawSourceUrlField.trim().length > 0
      ? rawSourceUrlField.trim()
      : null;
  const rawSourceNameField = form.get("sourceName");
  const sourceNameInput =
    typeof rawSourceNameField === "string" && rawSourceNameField.trim().length > 0
      ? rawSourceNameField.trim()
      : null;

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ...importErrorResponse("file_too_large"), maxBytes: MAX_BYTES },
      { status: 413 },
    );
  }

  // 2026-05-08 hotfix — normalize HEIC/PNG/etc. → JPEG via sharp so
  // Anthropic doesn't 400 on iPhone uploads. Edge cap 2048px.
  const rawBuf = Buffer.from(await file.arrayBuffer());
  let normalizedBuf: Buffer;
  let normalizedMime: string;
  try {
    const normalized = await normalizeImageForAi(rawBuf);
    normalizedBuf = normalized.buffer;
    normalizedMime = normalized.mediaType;
  } catch (err) {
    console.warn("[recipe-import/image] image normalization failed", err);
    captureRouteError(err, "/api/recipe-import/image", { stage: "normalize" });
    return NextResponse.json(importErrorResponse("file_too_large"), { status: 415 });
  }
  const b64 = normalizedBuf.toString("base64");
  const dataUrl = `data:${normalizedMime};base64,${b64}`;

  const SYSTEM_PROMPT = `You are helping import a recipe from a photo or screenshot.
Return a single JSON object with this shape (no markdown fences):
{
  "title": string or null,
  "ingredients": string[],
  "steps": string[],
  "notes": string or null
}
Rules:
- ingredients: one string per ingredient line as a cook would write it (include amounts).
- steps: ordered cooking steps; empty array if none visible.
- If text is unreadable, use best effort and short ingredients/steps arrays.`;

  let aiResult;
  try {
    aiResult = await callAiVision({
      callSite: "recipe-import/image",
      userId,
      systemPrompt: SYSTEM_PROMPT,
      userText: "Extract the recipe from this image.",
      imageDataUrl: dataUrl,
      expectJson: true,
      temperature: 0.2,
      maxTokens: 2000,
    });
  } catch (err) {
    if (err instanceof AiBudgetExceededError) {
      return NextResponse.json(
        { ...importErrorResponse("ai_capacity_reached"), retryAfterSec: err.retryAfterSec },
        { status: 503, headers: { "Retry-After": String(err.retryAfterSec) } },
      );
    }
    captureRouteError(err, "/api/recipe-import/image", { stage: "vision" });
    throw err;
  }

  if (!aiResult.ok) {
    // 429 → calmer copy with Retry-After. All other failures collapse to
    // the generic "couldn't read that image" copy. Don't echo upstream
    // body — would leak vendor + status (Audit I01, 2026-05-05).
    if (aiResult.error === "ai_rate_limited") {
      return NextResponse.json(
        importErrorResponse("ai_rate_limited"),
        { status: 429, headers: { "Retry-After": "30" } },
      );
    }
    return NextResponse.json(importErrorResponse("openai_http_error"), { status: aiResult.status });
  }

  let parsed: { title?: string | null; ingredients?: string[]; steps?: string[]; notes?: string | null };
  try {
    parsed = JSON.parse(aiResult.text) as typeof parsed;
  } catch {
    // Don't echo the raw model output — occasionally contains chunks of
    // the prompt or vendor identifiers (audit I01, 2026-05-05).
    return NextResponse.json(importErrorResponse("unparseable_model_output"), { status: 502 });
  }

  const ingredients = Array.isArray(parsed.ingredients)
    ? parsed.ingredients.map((s) => String(s).trim()).filter(Boolean)
    : [];
  const steps = Array.isArray(parsed.steps) ? parsed.steps.map((s) => String(s).trim()).filter(Boolean) : [];

  // Recipe-wave (2026-05-10) — pipeline telemetry. Fires per stage
  // so the next "wrong nutrition numbers" tester report can be
  // correlated to the exact stage that produced the bad number.
  traceExtraction(userId, "image", "ai_vision", {
    ingredientCount: ingredients.length,
    stepCount: steps.length,
  });

  let nutrition: Awaited<ReturnType<typeof verifyIngredients>> | null = null;
  if (ingredients.length > 0) {
    try {
      const parsedIngs = parseRawIngredients(ingredients);
      traceParsing(userId, "image", parsedIngs.length);
      nutrition = await verifyIngredients({ ingredients: parsedIngs, servings: 1 });
      traceNutritionLookup(userId, "image", {
        verified: nutrition.verified,
        primarySource: nutrition.primarySource,
        perServing: nutrition.perServing,
        servings: 1,
      });
    } catch (e) {
      console.error("[recipe-import/image] verifyIngredients failed:", e instanceof Error ? e.message : e);
    }
  }

  // F-156-recipe-wave — pipe the user-supplied URL through the
  // shared normaliser so the saved row carries the same shape as the
  // URL-import branch. Returns `{ source_url: null, source_name: null }`
  // when the input is empty or malformed.
  const attribution = normaliseSource({
    url: sourceUrlInput,
    name: sourceNameInput,
  });

  return NextResponse.json({
    ok: true,
    title: sanitiseImportedTitle(parsed.title),
    ingredients,
    steps,
    notes: parsed.notes ?? null,
    sourceUrl: attribution.source_url,
    sourceName: attribution.source_name,
    nutrition: nutrition
      ? {
          perServing: nutrition.perServing,
          ingredientRows: nutrition.verified.map((v) => ({
            name: v.resolved.name,
            amount: v.resolved.amount,
            unit: v.resolved.unit,
            confidence: v.confidence,
            source: v.source,
            macros: v.macros,
          })),
          overallConfidence: nutrition.verified.length > 0
            ? nutrition.verified.reduce((sum, v) => sum + v.confidence, 0) / nutrition.verified.length
            : 0,
        }
      : null,
  });
}
