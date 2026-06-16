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
import { AiBudgetExceededError, callAiVision } from "@/lib/server/aiProvider";
import { normalizeImageForAi } from "@/lib/server/normalizeImageForAi";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { serverTrack } from "@/lib/analytics/serverTrack";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { assertOrigin } from "@/lib/api/assertOrigin";

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

const SYSTEM_PROMPT = `You are a precise nutrition coach reading a photo of a meal.

Return a single JSON object describing the items on the plate. Group items by macro role and give each item a calorie RANGE (not a single number) — wider range when you're less sure.

EXACT JSON SHAPE (no markdown fences, no prose):
{
  "items": [
    {
      "name": "string — e.g. 'Grilled chicken breast', 'Cooked white rice', 'Pita', 'Half egg'",
      "category": "string — pick the best label for the macro role this item plays on the plate. Use one of the defaults ('Protein', 'Carbs', 'Fats', 'Vegetables', 'Sauce + dressing', 'Extras', 'Drinks', 'Sweets') OR supply your own when the plate calls for it (e.g. 'Rice + curry', 'Pasta + sauce').",
      "quantityHint": "string — verbal portion hint, e.g. '~150g', '1 breast', '1/2 cup', '~200ml'. OPTIONAL — omit only if truly impossible to judge.",
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
      "hint": "string — short reason or condition. OPTIONAL.",
      "calories": { "low": number, "high": number }
    }
  ],
  "notes": "string — short caveats, e.g. 'cooking oil not visible — likely +80-120 kcal', 'sauce portion unclear'. OPTIONAL."
}

MACRO RULES:
- ONE item per visible food (don't merge "chicken + rice" — break them out).
- Calorie ranges should be tight when you're sure (within ~15% of midpoint), wider when you're not. NEVER widen ranges to "feel safer" — be honest about uncertainty.
- "confidence" reflects how sure you are this item is the food you named at the portion you guessed:
   high: I'd bet money on this — clear visual, common food, standard portion.
   medium: probably correct, plausible alternatives exist.
   low: ambiguous — could be one of several things; portion is hard to read.
- Macro estimates (protein/carbs/fat) are REQUIRED for any food with a clear macro profile:
   - Any visible meat, fish, egg, legume, or dairy → ALWAYS fill in protein (and fat where relevant).
   - Any visible grain, bread, pasta, potato, rice, or noodle → ALWAYS fill in carbs.
   - Any visible oil, butter, cheese, fatty meat, or dressing → ALWAYS fill in fat.
   - Return null ONLY for genuinely mixed or ambiguous items where macro breakdown is unclear (e.g. a complex curry sauce with unknown ingredients).
- "addons" are foods NOT visible in the photo that commonly accompany what IS visible. Examples: charcuterie board -> wine; burger with no bun -> bun; salad with no visible dressing -> dressing. SKIP when nothing obvious applies.
- "notes" is for hidden-calorie caveats ONLY — "dressing not visible", "oil used in stir-fry not visible", "sauce portion unclear". Skip when there's nothing to say.
- DO NOT return totals — the client computes them from items.

HIDDEN CALORIES — flag these in "notes" when visible:
- Cooking oil: stir-fry, sautéed, or pan-fried food typically uses 1-2 tbsp oil (+120-240 kcal, not visible).
- Salad dressing: a dressed salad not showing the dressing adds ~30-80 kcal; "lightly dressed" ~30 kcal.
- Cooking sauces (teriyaki, sweet chilli, oyster, hoisin): 1-2 tbsp = 30-80 kcal each.
- Butter on toast / vegetables / rice: not always visible, +80-100 kcal per tbsp.

PORTION HEURISTICS (use these to anchor your estimates):
- A typical dinner plate is ~26cm across. A palm-sized protein is ~100-120g; a fist-sized carb portion is ~150-200g cooked.
- Restaurant / takeaway rice: usually 200-250g cooked = 260-325 kcal.
- Restaurant / takeaway pasta: usually 180-220g cooked = 290-350 kcal.

CALIBRATION ANCHORS — anchor every estimate to the nearest reference:

Proteins:
- 100g skinless grilled chicken breast: 165 kcal | P:31g C:0g F:3.6g
- 100g grilled salmon fillet: 208 kcal | P:20g C:0g F:13g
- 100g cooked lean ground beef (mince): 215 kcal | P:26g C:0g F:12g
- 100g cooked cod / white fish: 105 kcal | P:23g C:0g F:0.9g
- 1 large egg (50g): 78 kcal | P:6g C:0g F:5g
- 100g cooked prawns: 100 kcal | P:21g C:0g F:1g
- 100g firm tofu: 76 kcal | P:8g C:2g F:4g
- 100g cooked lentils / chickpeas: 120 kcal | P:9g C:20g F:2g

Carbs:
- 100g cooked white rice: 130 kcal | P:2.4g C:29g F:0.3g
- 100g cooked brown rice: 120 kcal | P:2.6g C:25g F:0.9g
- 100g cooked pasta (penne / spaghetti): 160 kcal | P:5.5g C:31g F:0.9g
- 100g cooked noodles (egg / rice): 140 kcal | P:3g C:29g F:1g
- 1 slice white bread (35g): 95 kcal | P:3g C:18g F:1g
- 1 slice wholemeal bread (35g): 85 kcal | P:4g C:15g F:1.2g
- 1 piece pita bread (~55g): 140 kcal | P:5g C:27g F:1g
- Medium baked potato (200g): 175 kcal | P:4g C:40g F:0.2g
- 100g cooked sweet potato: 90 kcal | P:2g C:21g F:0.1g
- 1 burger bun (50g): 135 kcal | P:4g C:25g F:2g

Fats + dairy:
- 1 tbsp olive / vegetable oil (14g): 120 kcal | F:14g
- 1 tbsp butter (14g): 100 kcal | F:11g
- 30g cheddar cheese: 124 kcal | P:7.5g C:0g F:10g
- 2 tbsp hummus (30g): 70-90 kcal | P:2g C:4g F:5g
- 1 tbsp peanut butter (16g): 95 kcal | P:4g C:3g F:8g

Snacks + extras:
- 4 slices salami (~30g): 120-140 kcal | P:5g C:0g F:11g
- 1 boiled egg: 78 kcal (half = 39 kcal)
- 10 green / black olives (~30g): 35-50 kcal | F:3-5g
- 2 tbsp tzatziki: 40-60 kcal
- 40-50g hard cheese (cheddar / manchego): 160-200 kcal
- Glass of red wine (175ml): 120-150 kcal
- 330ml beer (lager / ale): 130-160 kcal

Return ONLY the JSON object.`;

const USER_PROMPT =
  "Identify every food item on this plate. Return the JSON described in the system message.";

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  const routeStart = Date.now();

  // 2026-05-16 (ENG-519) — kill switch for AI photo-log.
  if (await isServerFeatureEnabled("kill_photo_log")) {
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message: "Photo logging is temporarily unavailable. Try again shortly.",
        retryAfterSec: 300,
      },
      { status: 503, headers: { "Retry-After": "300" } },
    );
  }

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
    captureRouteError(err, "/api/nutrition/photo-log", { stage: "normalize" });
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
  let visionResult;
  try {
    visionResult = await callAiVision({
      callSite: "photo-log",
      userId,
      systemPrompt: SYSTEM_PROMPT,
      userText: USER_PROMPT,
      imageDataUrl: dataUrl,
      expectJson: true,
      temperature: 0.3,
      maxTokens: 2500,
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
    captureRouteError(err, "/api/nutrition/photo-log", { stage: "vision" });
    throw err;
  }
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

  const resp = outcome.response satisfies PhotoLogRangedResponse;
  const confidenceTier =
    resp.items.every((it) => it.confidence === "high")
      ? "high"
      : resp.items.some((it) => it.confidence === "low")
        ? "low"
        : "medium";

  void serverTrack(AnalyticsEvents.photo_log_api_completed, userId, {
    totalElapsedMs: Date.now() - routeStart,
    itemCount: resp.items.length,
    confidenceTier,
    tier,
  });

  return NextResponse.json({ ...resp, freeQuotaRemaining });
}
