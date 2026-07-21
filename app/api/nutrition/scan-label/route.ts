import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import {
  FREE_PHOTO_LOG_WEEKLY_LIMIT,
  FREE_PHOTO_LOG_WINDOW_MS,
} from "@/lib/nutrition/photoLogQuota";
import { AiBudgetExceededError, callAiVision } from "@/lib/server/aiProvider";
import { normalizeImageForAi } from "@/lib/server/normalizeImageForAi";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { checkMacroPlausibility } from "@/lib/nutrition/macroPlausibility";
import { assertOrigin } from "@/lib/api/assertOrigin";

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
 *     // Diagnostic, surfaced in the UI as a confidence chip. Forced to
 *     // "low" when the Atwater plausibility check fails.
 *     confidence: "high" | "medium" | "low",
 *     // True when the resolved per-100g macros fail the shared Atwater
 *     // plausibility gate (kcal vs 4/4/9). The client warns the user to
 *     // double-check before saving; we never silently accept (2026-06-11).
 *     implausible: boolean,
 *     plausibilityReason: string | null
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
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  // 2026-05-16 (ENG-519) — kill switch for AI label scanning.
  if (await isServerFeatureEnabled("kill_scan_label")) {
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message: "Label scanning is temporarily unavailable. Try again shortly.",
        retryAfterSec: 300,
      },
      { status: 503, headers: { "Retry-After": "300" } },
    );
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ENG-1487 finding #2 (2026-07-10): this route previously had no tier
  // gate at all — every account, free or Pro, shared the same flat 30/day
  // cap. That made it a cheap fleet-DoS/cost vector: farmed FREE accounts
  // could each burn 30 vision calls/day at ~2p apiece with no entitlement
  // check. Free tier now gets the same small weekly taster bucket as
  // photo-log (a comparable vision-call cost class); Pro keeps the
  // existing 30/day cap unchanged.
  const tier = await getUserTier(userId);
  if (tier !== "pro") {
    const freeLimited = await rateLimit({
      keyPrefix: "api:scan-label:free-quota",
      userId,
      limit: FREE_PHOTO_LOG_WEEKLY_LIMIT,
      windowMs: FREE_PHOTO_LOG_WINDOW_MS,
    });
    if (!freeLimited.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "upgrade_required",
          message:
            "You've used all your free label scans this week. Pro unlocks label scanning up to 30 a day.",
          freeQuotaRemaining: 0,
        },
        { status: 403 },
      );
    }
  } else {
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

  // 2026-05-08 hotfix — iPhone Camera defaults to HEIC which Anthropic
  // rejects (only supports jpeg/png/gif/webp). Normalize EVERY incoming
  // image to JPEG via sharp (handles HEIC/PNG/WebP/etc. → JPEG) and
  // cap edge at 2048px so we don't blow Anthropic's per-image token
  // budget on multi-MB photos. Falls through to the existing 502
  // ai_internal_error path if the bytes are corrupt or an unsupported
  // format we can't read.
  const rawBuf = Buffer.from(await file.arrayBuffer());
  let normalizedBuf: Buffer;
  let normalizedMime: string;
  try {
    const normalized = await normalizeImageForAi(rawBuf);
    normalizedBuf = normalized.buffer;
    normalizedMime = normalized.mediaType;
    if (normalized.sourceFormat !== "image/jpeg") {
      console.info(
        `[scan-label] normalized ${normalized.sourceFormat} → image/jpeg (${rawBuf.length} → ${normalizedBuf.length} bytes)`,
      );
    }
  } catch (err) {
    console.warn("[scan-label] image normalization failed", err);
    captureRouteError(err, "/api/nutrition/scan-label", { stage: "normalize" });
    return NextResponse.json(
      {
        ok: false,
        error: "image_unreadable",
        message:
          "Couldn't read that image. Try a sharper, well-lit photo of the nutrition panel.",
      },
      { status: 415 },
    );
  }
  const b64 = normalizedBuf.toString("base64");
  const dataUrl = `data:${normalizedMime};base64,${b64}`;

  const ac = new AbortController();
  const timeoutHandle = setTimeout(() => ac.abort(), AI_TIMEOUT_MS);
  let ai;
  try {
    ai = await callAiVision({
      callSite: "scan-label",
      userId,
      systemPrompt: SYSTEM_PROMPT,
      userText: USER_PROMPT,
      imageDataUrl: dataUrl,
      expectJson: true,
      temperature: 0.1, // tight — we want the model to read literal label values
      maxTokens: 800,
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (err instanceof AiBudgetExceededError) {
      return NextResponse.json(
        {
          ok: false,
          error: "ai_capacity_reached",
          message:
            "AI is temporarily at capacity. Try again in a few hours or log manually.",
          retryAfterSec: err.retryAfterSec,
        },
        { status: 503, headers: { "Retry-After": String(err.retryAfterSec) } },
      );
    }
    captureRouteError(err, "/api/nutrition/scan-label", { stage: "vision" });
    throw err;
  }
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

  // Plausibility gate (2026-06-11) — run the resolved per-100g macros
  // through the shared Atwater check before handing them to the client to
  // pre-fill a form. An OCR mis-read (e.g. "21g protein" read as "210g", or
  // a kcal value that doesn't match the macros) is FLAGGED, never silently
  // accepted: we downgrade confidence to "low" and set `implausible: true`
  // so the custom-food / correction form can warn the user to double-check
  // before saving. We do NOT hard-reject — the user is the source of truth
  // and may be reading a genuinely unusual product (e.g. pure oil).
  const plausibility = checkMacroPlausibility({
    calories: calories ?? 0,
    protein: protein ?? 0,
    carbs: carbs ?? 0,
    fat: fat ?? 0,
  });
  const modelConfidence =
    parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
      ? parsed.confidence
      : "medium";
  const confidence: "high" | "medium" | "low" = plausibility.ok ? modelConfidence : "low";

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
    confidence,
    // True when the extracted per-100g macros fail the Atwater plausibility
    // check (kcal vs 4/4/9, range, single-macro). The client surfaces a
    // "double-check these numbers" warning on pre-fill. `reason` is the
    // specific failure for telemetry / copy.
    implausible: !plausibility.ok,
    plausibilityReason: plausibility.ok ? null : plausibility.reason,
  });
}
