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

export const runtime = "nodejs";

// F-108 (2026-05-07): GPT-4o vision over a multi-MB base64 image
// regularly takes 12-20s. Vercel's default 10s/15s caps were killing
// the route mid-call, leaving the mobile client with an aborted
// stream that hit the swallowed `catch {}` and surfaced the generic
// "Photo logging failed" toast. Match `/api/recipe-import` (50s) +
// headroom for the bigger payload. Claude vision (Sonnet 4.6) is
// usually faster but the ceiling stays the same to absorb the long-
// tail.
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
 * migrated from OpenAI GPT-4o to Anthropic Claude Sonnet 4.6 to give us
 * a single vision provider across the platform (also used for label-
 * photo verify in the food-correction pipeline). The OpenAI path stays
 * as a fallback for one TestFlight cycle while Grace confirms parity —
 * Claude is used when `ANTHROPIC_API_KEY` is set, OpenAI otherwise.
 *
 * The previous "identify -> verifyIngredients" pipeline blanket-failed
 * (502 `verify_failed` / 422 `no_food_detected`) the moment any single
 * item couldn't be matched against USDA / OFF / FatSecret. This route
 * never blanket-fails on partial matches — if the model returns ANY
 * items, we return them. The optional per-item "Verify with database"
 * action lives client-side and POSTs the single ingredient back to
 * `/api/nutrition/verify-recipe` to swap that one row to a database-
 * matched single-number row.
 *
 * Response shape: see `PhotoLogRangedResponse`.
 */

// Re-export the canonical types so existing imports
// (`import type { PhotoLogResponse } from "app/api/nutrition/photo-log/route"`)
// still resolve.
export type { PhotoLogRangedResponse as PhotoLogResponse } from "@/lib/nutrition/photoLogRanges";
export type {
  PhotoLogItemRanged as PhotoLogItem,
  PhotoLogAddon,
  Range as KcalRange,
} from "@/lib/nutrition/photoLogRanges";

const CLAUDE_MODEL = "claude-sonnet-4-6";
const OPENAI_MODEL = "gpt-4o";

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

type VisionResult =
  | { ok: true; rawJson: string; modelVersion: string; vendor: "claude" | "openai" }
  | {
      ok: false;
      status: number;
      error: string;
      message: string;
      modelVersion: string;
      vendor: "claude" | "openai";
    };

async function callClaudeVision(
  key: string,
  dataUrl: string,
  ac: AbortController,
): Promise<VisionResult> {
  // Anthropic Messages API expects base64 + media_type separately,
  // not a data URL. Strip the prefix safely (`data:image/jpeg;base64,...`).
  const dataUrlMatch = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!dataUrlMatch) {
    return {
      ok: false,
      status: 500,
      error: "ai_internal_error",
      message: "Could not prepare the image for the AI service.",
      modelVersion: CLAUDE_MODEL,
      vendor: "claude",
    };
  }
  const [, mediaType, b64] = dataUrlMatch;

  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: ac.signal,
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2500,
        // 0.3 — same calibration as the OpenAI path; cold enough to be
        // deterministic but warm enough that ranges don't collapse.
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: b64 },
              },
            ],
          },
          // Prefill `{` so the response is guaranteed to start with a
          // JSON object (no preamble like "Here's the analysis:").
          // We prepend `{` back to the response before parsing.
          { role: "assistant", content: "{" },
        ],
      }),
    });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const isAbort =
      (err instanceof Error && err.name === "AbortError") ||
      (err as { name?: string } | null)?.name === "AbortError";
    if (isAbort) {
      console.warn(
        `[photo-log] claude timeout after ${elapsedMs}ms (limit ${AI_TIMEOUT_MS}ms)`,
      );
      return {
        ok: false,
        status: 504,
        error: "ai_timeout",
        message: "The AI took too long to respond. Try again in a moment.",
        modelVersion: CLAUDE_MODEL,
        vendor: "claude",
      };
    }
    console.error("[photo-log] claude fetch threw", err);
    return {
      ok: false,
      status: 502,
      error: "ai_network_error",
      message: "Could not reach the AI service. Please try again.",
      modelVersion: CLAUDE_MODEL,
      vendor: "claude",
    };
  }

  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => "");
    console.warn(
      `[photo-log] claude non-200 status=${res.status} bodyPreview=${bodyPreview.slice(0, 200)}`,
    );
    return {
      ok: false,
      status: 502,
      error: "ai_http_error",
      message:
        res.status === 429
          ? "The AI service is busy right now. Try again in a moment."
          : "The AI service had a problem with this image. Try a different photo or angle.",
      modelVersion: CLAUDE_MODEL,
      vendor: "claude",
    };
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";
  // Re-attach the prefilled `{` so the parser sees a complete object.
  const rawJson = text.startsWith("{") ? text : `{${text}`;
  return { ok: true, rawJson, modelVersion: CLAUDE_MODEL, vendor: "claude" };
}

async function callOpenAIVision(
  key: string,
  dataUrl: string,
  ac: AbortController,
): Promise<VisionResult> {
  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: ac.signal,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.3,
        max_tokens: 2500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const isAbort =
      (err instanceof Error && err.name === "AbortError") ||
      (err as { name?: string } | null)?.name === "AbortError";
    if (isAbort) {
      console.warn(
        `[photo-log] openai timeout after ${elapsedMs}ms (limit ${AI_TIMEOUT_MS}ms)`,
      );
      return {
        ok: false,
        status: 504,
        error: "ai_timeout",
        message: "The AI took too long to respond. Try again in a moment.",
        modelVersion: OPENAI_MODEL,
        vendor: "openai",
      };
    }
    console.error("[photo-log] openai fetch threw", err);
    return {
      ok: false,
      status: 502,
      error: "ai_network_error",
      message: "Could not reach the AI service. Please try again.",
      modelVersion: OPENAI_MODEL,
      vendor: "openai",
    };
  }

  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => "");
    console.warn(
      `[photo-log] openai non-200 status=${res.status} bodyPreview=${bodyPreview.slice(0, 200)}`,
    );
    return {
      ok: false,
      status: 502,
      error: "ai_http_error",
      message:
        res.status === 429
          ? "The AI service is busy right now. Try again in a moment."
          : "The AI service had a problem with this image. Try a different photo or angle.",
      modelVersion: OPENAI_MODEL,
      vendor: "openai",
    };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
  return { ok: true, rawJson: raw, modelVersion: OPENAI_MODEL, vendor: "openai" };
}

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const tier = await getUserTier(userId);
  // 2026-05-02 — photo-log is no longer Pro-only. Free + Base get
  // FREE_PHOTO_LOG_WEEKLY_LIMIT (=5) free photo logs per rolling 7-day
  // window via a separate `api:photo-log:free-quota` bucket; Pro keeps
  // the existing `api:photo-log` 100/day cap. The previous blanket
  // `tier !== "pro"` 403 is gone — the gate is the SECOND photo after
  // exhaustion, not the FIRST. See
  // `docs/decisions/2026-05-02-photo-log-free-taster.md`.
  const isFree = tier !== "pro";

  // `freeQuotaRemaining` is `null` for Pro (uncapped at the
  // user-visible level — the 100/day bucket is plumbing) and a
  // non-negative integer for Free / Base. The success response
  // surfaces this so the client renders an authoritative "X free
  // logs remaining this week" line.
  let freeQuotaRemaining: number | null = null;

  if (isFree) {
    // Free-taster bucket — drains independently of the Pro 100/day
    // bucket. We increment up-front so an attacker who deliberately
    // exhausts the quota cannot also drain our AI budget. The
    // tradeoff (a network/parse failure burns one of the user's 5
    // weekly logs) is documented in the decision doc as a known v1
    // limitation; see "Quota burn on upstream error" in
    // `docs/decisions/2026-05-02-photo-log-free-taster.md`.
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

  // Vendor selection: prefer Claude when its key is set, fall back to
  // OpenAI otherwise. Lets us flip between providers without a redeploy
  // by toggling env vars in Vercel during the migration window.
  const claudeKey = process.env.ANTHROPIC_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const useClaude = !!claudeKey;
  if (!claudeKey && !openaiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "ai_not_configured",
        message:
          "AI service not configured. Set ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY.",
      },
      { status: 503 },
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
    return NextResponse.json({ ok: false, error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const b64 = buf.toString("base64");
  const dataUrl = `data:${mime};base64,${b64}`;

  const ac = new AbortController();
  const timeoutHandle = setTimeout(() => ac.abort(), AI_TIMEOUT_MS);
  const visionResult = useClaude
    ? await callClaudeVision(claudeKey!, dataUrl, ac)
    : await callOpenAIVision(openaiKey!, dataUrl, ac);
  clearTimeout(timeoutHandle);

  if (!visionResult.ok) {
    return NextResponse.json(
      { ok: false, error: visionResult.error, message: visionResult.message },
      { status: visionResult.status },
    );
  }

  let parsedJson: unknown;
  try {
    // Strip a stray code fence just in case the model regressed
    // (Claude with prefill, or OpenAI in JSON-object mode, should
    // never emit one — but defence in depth).
    const cleaned = visionResult.rawJson
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

  // 2026-05-02 — surface `freeQuotaRemaining` on the success response
  // so the client's quota line is authoritative after the first
  // successful analyse.
  return NextResponse.json({
    ...(outcome.response satisfies PhotoLogRangedResponse),
    freeQuotaRemaining,
  });
}
