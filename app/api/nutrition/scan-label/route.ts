import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { callAiVision } from "@/lib/server/aiProvider";

export const runtime = "nodejs";
export const maxDuration = 45;

const MAX_BYTES = 6 * 1024 * 1024;
const AI_TIMEOUT_MS = 40_000;

/**
 * POST /api/nutrition/scan-label
 *
 * 2026-05-08 build-45 follow-up — when a user scans a barcode that's
 * not in the database, we let them snap the nutrition label instead.
 * Pre-fix: that path went to /api/nutrition/photo-log (meal-log
 * estimator) which returned ranged macros for today's diary but
 * never wrote anything to user_foods, so the next scan of the same
 * barcode failed identically.
 *
 * Post-fix: this dedicated endpoint reads a single nutrition label
 * (Claude Sonnet 4.5 vision), returns structured per-100g values +
 * product name, and the mobile client pre-fills the existing
 * Correct-Product form with the result. The user reviews the
 * extracted values, hits Save Correction, and the existing
 * submitFoodCorrection path runs the values through the Phase 2
 * plausibility gate and writes them to user_foods (verification_status
 * = 'pending'), keyed to the scanned barcode. Next scan of the same
 * barcode hits user_foods first, then OFF.
 *
 * Decision doc:
 *   docs/decisions/2026-05-08-food-correction-verification-pipeline.md
 *
 * Auth: required (per-user rate-limited).
 * Body: multipart/form-data with `image` (jpg/png/webp, ≤6MB) and
 *   optional `barcode` field (string, 8-14 digits).
 *
 * Response (ok):
 *   {
 *     ok: true,
 *     name: string | null,
 *     calories: number,         // per 100 g
 *     protein: number,          // per 100 g
 *     carbs: number,            // per 100 g
 *     fat: number,              // per 100 g
 *     fiberG: number,           // per 100 g
 *     sugarG: number | null,    // per 100 g, omitted when label doesn't show it
 *     sodiumMg: number | null,
 *     saturatedFatG: number | null,
 *     servingSizeG: number | null,
 *     // Diagnostic, surfaced in the UI as a confidence chip.
 *     confidence: "high" | "medium" | "low"
 *   }
 *
 * Response (error):
 *   { ok: false, error: string, message: string }
 */

const SYSTEM_PROMPT = `You are reading a nutrition label from a food product photo.

Extract the values from the label exactly as printed. Do NOT estimate. Do NOT round aggressively. Do NOT make up values that aren't on the label.

Return a single JSON object (no markdown fences, no prose):
{
  "name": "string or null — best-effort product name from the front of the package (brand + product) when visible. Null when not visible.",
  "perServing": {
    "servingSizeG": number or null,
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "fiberG": number or null,
    "sugarG": number or null,
    "sodiumMg": number or null,
    "saturatedFatG": number or null
  },
  "per100g": {
    "calories": number or null,
    "protein": number or null,
    "carbs": number or null,
    "fat": number or null,
    "fiberG": number or null,
    "sugarG": number or null,
    "sodiumMg": number or null,
    "saturatedFatG": number or null
  } | null,
  "confidence": "high" | "medium" | "low"
}

RULES:
- Many EU labels show BOTH "per serving" and "per 100 g" columns. Extract both.
- US labels usually only show "per serving" — set "per100g" to null in that case; the caller will scale.
- Sodium MUST be in milligrams. If the label shows salt in g, convert: 1 g salt ≈ 400 mg sodium.
- Calories field on UK/EU labels is sometimes labelled "Energy" with both kJ and kcal — return the kcal value.
- "confidence": "high" when both per-serving and per-100g columns are clearly visible AND consistent. "medium" when only one column is visible or there's minor ambiguity. "low" when label is partially obscured / blurry / handwritten.
- Return ONLY the JSON object.`;

const USER_PROMPT =
  "Read this nutrition label and return the structured JSON described above.";

type RawLabelPayload = {
  name?: string | null;
  perServing?: {
    servingSizeG?: number | null;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiberG?: number | null;
    sugarG?: number | null;
    sodiumMg?: number | null;
    saturatedFatG?: number | null;
  };
  per100g?: {
    calories?: number | null;
    protein?: number | null;
    carbs?: number | null;
    fat?: number | null;
    fiberG?: number | null;
    sugarG?: number | null;
    sodiumMg?: number | null;
    saturatedFatG?: number | null;
  } | null;
  confidence?: "high" | "medium" | "low";
};

function safe(n: number | null | undefined, decimals: 0 | 1 = 1): number {
  if (n == null || !Number.isFinite(n) || n < 0) return 0;
  const f = decimals === 0 ? 1 : 10;
  return Math.round(n * f) / f;
}

function safeOptional(n: number | null | undefined, decimals: 0 | 1 = 1): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  const f = decimals === 0 ? 1 : 10;
  return Math.round(n * f) / f;
}

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Same per-user budget as photo-log to avoid burning the AI budget
  // on a single user spamming label scans.
  const limited = await rateLimit({
    keyPrefix: "api:scan-label",
    userId,
    limit: 30,
    windowMs: 24 * 60 * 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "expected_multipart" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "file_too_large", maxBytes: MAX_BYTES },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const b64 = buf.toString("base64");
  const dataUrl = `data:${mime};base64,${b64}`;

  const ac = new AbortController();
  const timeoutHandle = setTimeout(() => ac.abort(), AI_TIMEOUT_MS);
  const ai = await callAiVision({
    callSite: "scan-label",
    systemPrompt: SYSTEM_PROMPT,
    userText: USER_PROMPT,
    imageDataUrl: dataUrl,
    expectJson: true,
    temperature: 0.1, // tight — we want the model to read literal label values
    maxTokens: 800,
    signal: ac.signal,
  });
  clearTimeout(timeoutHandle);

  if (!ai.ok) {
    return NextResponse.json(
      { ok: false, error: ai.error, message: ai.message },
      { status: ai.status },
    );
  }

  let parsed: RawLabelPayload;
  try {
    const cleaned = ai.text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    parsed = JSON.parse(cleaned) as RawLabelPayload;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "model_unparseable",
        message: "Couldn't read the label. Try a sharper, well-lit photo of the nutrition panel.",
      },
      { status: 502 },
    );
  }

  // Resolve to per-100g. Prefer the per100g column when present.
  // Otherwise scale per-serving by serving-size.
  let calories: number | null = null;
  let protein: number | null = null;
  let carbs: number | null = null;
  let fat: number | null = null;
  let fiberG: number | null = null;
  let sugarG: number | null = null;
  let sodiumMg: number | null = null;
  let saturatedFatG: number | null = null;
  const servingSizeG = safeOptional(parsed.perServing?.servingSizeG, 1);

  if (parsed.per100g && parsed.per100g.calories != null) {
    calories = safe(parsed.per100g.calories, 0);
    protein = safe(parsed.per100g.protein, 1);
    carbs = safe(parsed.per100g.carbs, 1);
    fat = safe(parsed.per100g.fat, 1);
    fiberG = safe(parsed.per100g.fiberG, 1);
    sugarG = safeOptional(parsed.per100g.sugarG, 1);
    sodiumMg = safeOptional(parsed.per100g.sodiumMg, 0);
    saturatedFatG = safeOptional(parsed.per100g.saturatedFatG, 1);
  } else if (parsed.perServing && servingSizeG && servingSizeG > 0) {
    const k = 100 / servingSizeG;
    calories = safe((parsed.perServing.calories ?? 0) * k, 0);
    protein = safe((parsed.perServing.protein ?? 0) * k, 1);
    carbs = safe((parsed.perServing.carbs ?? 0) * k, 1);
    fat = safe((parsed.perServing.fat ?? 0) * k, 1);
    fiberG = safe((parsed.perServing.fiberG ?? 0) * k, 1);
    sugarG = safeOptional((parsed.perServing.sugarG ?? 0) * k, 1);
    sodiumMg = safeOptional((parsed.perServing.sodiumMg ?? 0) * k, 0);
    saturatedFatG = safeOptional((parsed.perServing.saturatedFatG ?? 0) * k, 1);
  } else {
    return NextResponse.json(
      {
        ok: false,
        error: "label_unreadable",
        message:
          "Couldn't extract per-100g values from the label. Try a sharper photo or enter the values manually.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    name: typeof parsed.name === "string" ? parsed.name.trim() || null : null,
    calories,
    protein,
    carbs,
    fat,
    fiberG,
    sugarG,
    sodiumMg,
    saturatedFatG,
    servingSizeG,
    confidence:
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : "medium",
  });
}
