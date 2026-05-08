import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { verifyIngredients, parseRawIngredients } from "@/lib/nutrition/verifyIngredients";
import { importErrorResponse } from "@/lib/recipes/importErrorCopy";
import { sanitiseImportedTitle } from "@/lib/recipe-import/extractSocialRecipe";
import { callAiVision, activeVendor } from "@/lib/server/aiProvider";
import { normalizeImageForAi } from "@/lib/server/normalizeImageForAi";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Image → ingredient lines via Claude vision (Anthropic, default) or
 * OpenAI vision fallback. 2026-05-08 migration:
 * `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`.
 */
export async function POST(req: Request) {
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

  const aiResult = await callAiVision({
    callSite: "recipe-import/image",
    systemPrompt: SYSTEM_PROMPT,
    userText: "Extract the recipe from this image.",
    imageDataUrl: dataUrl,
    expectJson: true,
    temperature: 0.2,
    maxTokens: 2000,
  });

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

  let nutrition: Awaited<ReturnType<typeof verifyIngredients>> | null = null;
  if (ingredients.length > 0) {
    try {
      const parsedIngs = parseRawIngredients(ingredients);
      nutrition = await verifyIngredients({ ingredients: parsedIngs, servings: 1 });
    } catch (e) {
      console.error("[recipe-import/image] verifyIngredients failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    ok: true,
    title: sanitiseImportedTitle(parsed.title),
    ingredients,
    steps,
    notes: parsed.notes ?? null,
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
