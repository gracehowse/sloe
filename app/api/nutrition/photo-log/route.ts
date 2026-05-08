import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import {
  parsePhotoLogRangedResponse,
  type PhotoLogRangedResponse,
} from "@/lib/nutrition/photoLogRanges";
import {
  FREE_PHOTO_LOG_WEEKLY_LIMIT,
  FREE_PHOTO_LOG_WINDOW_MS,
} from "@/lib/nutrition/photoLogQuota";
import { callAiVision } from "@/lib/server/aiProvider";
import { normalizeImageForAi } from "@/lib/server/normalizeImageForAi";

export const runtime = "nodejs";

// F-108 (2026-05-07): vision over a multi-MB base64 image regularly
// takes 12-20s on GPT-4o; Claude Sonnet 4.6 is usually faster but the
// ceiling is the same to absorb the long-tail. Vercel's default 10s/15s
// caps were killing the route mid-call, leaving the mobile client with
// an aborted stream that hit the swallowed `catch {}` and surfaced the
// generic "Photo logging failed" toast.
export const maxDuration = 60;

const MAX_BYTES = 6 * 1024 * 1024;
// Sub-platform timeout — slightly under `maxDuration` so we return a
// structured `ai_timeout` error instead of being killed by Vercel.
const AI_TIMEOUT_MS = 55_000;

/**
 * Re-architected 2026-05-01 (`docs/decisions/2026-05-01-photo-log-rangefirst.md`).
 *
 * Single vision call that returns an itemized breakdown grouped by
 * macro role, with per-item kcal RANGES (not point estimates),
 * optional add-on suggestions, and a plate total range.
 *
 * 2026-05-08 (`docs/decisions/2026-05-08-food-correction-verification-pipeline.md`):
 * migrated from OpenAI GPT-4o to Anthropic Claude Sonnet 4.6 vision
 * via the shared `callAiVision` helper. The OpenAI fallback path stays
 * inside the helper for one TestFlight cycle while parity is confirmed.
 */

export type { PhotoLogRangedResponse as PhotoLogResponse } from "@/lib/nutrition/photoLogRanges";
export type {
  PhotoLogItemRanged as PhotoLogItem,
  PhotoLogAddon,
  Range as KcalRange,
} from "@/lib/nutrition/photoLogRanges";

const SYSTEM_PROMPT = `You are a nutrition coach reading a photo of a meal.

Return a single JSON object describing the items on the plate. Group items by macro role and give each item a calorie RANGE (not a single number) — wider range when you're less sure.

EXACT JSON SHAPE (no markdown fences, no prose):
{
  "items": [
    {
      "name": "string — e.g. 'Pita', 'Hummus', 'Cheese', 'Half egg'",
      "category": "string — one of 'Bread + dips', 'Protein + fats', 'Extras', 'Drinks', 'Sweets'. Pick the one that fits best, OR supply your own short label if a different role fits the plate (e.g. 'Pasta + sauce', 'Rice + curry').",
      "quantityHint": "string — verbal portion hint, e.g. '~40-50g', '1 piece', '1/2 cup', 'small handful'. OPTIONAL — omit if you can't tell.",
      "calories": { "low": number, "high": number },
      "protein": { "low": number, "high": number } | null,
      "carbs": { "low": number, "high": number } | null,
      "fat": { "low": number, "high": number } | null,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "addons": [
    {
      "name": "string — common pairing NOT in the photo, e.g. 'Glass of wine', 'Bun', 'Butter'",
      "hint": "string — short reason or condition, e.g. 'if also drinking wine'. OPTIONAL.",
      "calories": { "low": number, "high": number }
    }
  ],
  "notes": "string — short caveats, e.g. 'dressing not visible — likely +30-50 kcal'. OPTIONAL."
}

RULES:
- ONE item per visible food (don't merge "salami + cheese" — break them out).
- Calorie ranges should be tight when you're sure (within ~15% of midpoint), wider when you're not. NEVER widen ranges to "feel safer" — be honest about uncertainty.
- "confidence" reflects how sure you are this item is the food you named at the portion you guessed:
   high: I'd bet money on this — clear visual, common food, standard portion.
   medium: probably correct, plausible alternatives exist.
   low: ambiguous — could be one of several things; portion is hard to read.
- Macros (protein/carbs/fat) are OPTIONAL per item. Return null when you can't reasonably estimate.
- "addons" are foods NOT visible in the photo that commonly go with what IS visible. Examples: a charcuterie plate -> wine; a burger photo with no bun -> bun; bread with no spread -> butter. SKIP this field (or return []) when nothing obvious applies.
- "notes" is for short caveats only — "dressing not visible", "olive oil glaze likely +30 kcal". Skip when there's nothing to say.
- DO NOT return totals — the client computes them from items.

CALIBRATION EXAMPLES (use these as reference points):
- 1 piece of pita bread: 120-150 kcal
- 2 tbsp hummus: 70-100 kcal
- 2 tbsp tzatziki: 40-60 kcal
- 2 tbsp tapenade: 60-90 kcal
- 40-50g hard cheese (cheddar / manchego): 160-200 kcal
- 4 slices salami: 120-150 kcal
- 1 boiled egg: 70 kcal (so half = 35)
- 10 olives: 35-50 kcal
- Small Greek salad (feta + olive oil): 80-150 kcal
- Glass of red wine (175ml): 120-150 kcal
- 1 burger bun: 120-160 kcal
- 1 tbsp butter: 100 kcal

Return ONLY the JSON object.`;

const USER_PROMPT =
  "Identify every food item on this plate. Return the JSON described in the system message.";

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const tier = await getUserTier(userId);
  // 2026-05-02 — photo-log is no longer Pro-only. Free + Base get
  // FREE_PHOTO_LOG_WEEKLY_LIMIT (=5) free photo logs per rolling 7-day
  // window via a separate `api:photo-log:free-quota` bucket; Pro keeps
  // the existing `api:photo-log` 100/day cap. See
  // `docs/decisions/2026-05-02-photo-log-free-taster.md`.
  const isFree = tier !== "pro";

  let freeQuotaRemaining: number | null = null;

  if (isFree) {
    const freeLimited = await rateLimit({
      keyPrefix: "api:photo-log:free-quota",
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
            "You've used your free photo logs for this week. Upgrade to Pro for unlimited.",
          freeQuotaRemaining: 0,
        },
        { status: 403 },
      );
    }
    freeQuotaRemaining = freeLimited.remaining;
  } else {
    const limited = await rateLimit({
      keyPrefix: "api:photo-log",
      userId,
      limit: 100,
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
    return NextResponse.json({ ok: false, error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 });
  }

  // 2026-05-08 hotfix — iPhone HEIC isn't supported by Anthropic;
  // normalize to JPEG via sharp before sending to Claude. Caps the
  // edge at 2048px to stay under Anthropic's per-image token budget.
  const rawBuf = Buffer.from(await file.arrayBuffer());
  let normalizedBuf: Buffer;
  let normalizedMime: string;
  try {
    const normalized = await normalizeImageForAi(rawBuf);
    normalizedBuf = normalized.buffer;
    normalizedMime = normalized.mediaType;
  } catch (err) {
    console.warn("[photo-log] image normalization failed", err);
    return NextResponse.json(
      {
        ok: false,
        error: "image_unreadable",
        message: "Couldn't read that image. Try a different photo.",
      },
      { status: 415 },
    );
  }
  const b64 = normalizedBuf.toString("base64");
  const dataUrl = `data:${normalizedMime};base64,${b64}`;

  const ac = new AbortController();
  const timeoutHandle = setTimeout(() => ac.abort(), AI_TIMEOUT_MS);
  const visionResult = await callAiVision({
    callSite: "photo-log",
    systemPrompt: SYSTEM_PROMPT,
    userText: USER_PROMPT,
    imageDataUrl: dataUrl,
    expectJson: true,
    temperature: 0.3,
    maxTokens: 2500,
    signal: ac.signal,
  });
  clearTimeout(timeoutHandle);

  if (!visionResult.ok) {
    return NextResponse.json(
      { ok: false, error: visionResult.error, message: visionResult.message },
      { status: visionResult.status },
    );
  }

  let parsedJson: unknown;
  try {
    const cleaned = visionResult.text
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/, "");
    parsedJson = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "model_unparseable",
        message: "Couldn't read the AI's reply. Try a different angle.",
      },
      { status: 502 },
    );
  }

  const outcome = parsePhotoLogRangedResponse(parsedJson, visionResult.modelVersion);
  if (outcome.kind === "unparseable") {
    return NextResponse.json(
      {
        ok: false,
        error: "model_unparseable",
        message: "Couldn't read the AI's reply. Try a different angle.",
      },
      { status: 502 },
    );
  }
  if (outcome.kind === "no_items") {
    return NextResponse.json(
      {
        ok: false,
        error: "no_food_detected",
        message: "No food detected in the photo. Try a clearer, well-lit shot.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ...(outcome.response satisfies PhotoLogRangedResponse),
    freeQuotaRemaining,
  });
}
