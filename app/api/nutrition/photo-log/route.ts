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
// headroom for the bigger payload.
export const maxDuration = 60;

const MAX_BYTES = 6 * 1024 * 1024;
// F-108 (2026-05-07): explicit OpenAI request timeout. Slightly under
// `maxDuration` so we return a structured `openai_timeout` error
// instead of being killed by the platform.
const OPENAI_TIMEOUT_MS = 55_000;

/**
 * Re-architected 2026-05-01 (`docs/decisions/2026-05-01-photo-log-rangefirst.md`).
 *
 * Single GPT-4o vision call that returns an itemized breakdown grouped
 * by macro role, with per-item kcal RANGES (not point estimates),
 * optional add-on suggestions, and a plate total range.
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
// still resolve. The legacy point-estimate shape is gone — keep the
// type alias name for code-search continuity but point it at the new
// range-first contract.
export type { PhotoLogRangedResponse as PhotoLogResponse } from "@/lib/nutrition/photoLogRanges";
export type {
  PhotoLogItemRanged as PhotoLogItem,
  PhotoLogAddon,
  Range as KcalRange,
} from "@/lib/nutrition/photoLogRanges";

const MODEL_VERSION = "gpt-4o";

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
    // exhausts the quota cannot also drain our OpenAI budget. The
    // tradeoff (a network/parse failure burns one of the user's 5
    // weekly logs) is documented in the decision doc as a known v1
    // limitation; see "Quota burn on upstream error" in
    // `docs/decisions/2026-05-02-photo-log-free-taster.md`. Revisit
    // with a credit-on-error counter table if the cohort metric
    // shows real-world friction.
    const freeLimited = await rateLimit({
      keyPrefix: "api:photo-log:free-quota",
      userId,
      limit: FREE_PHOTO_LOG_WEEKLY_LIMIT,
      windowMs: FREE_PHOTO_LOG_WINDOW_MS,
    });
    if (!freeLimited.ok) {
      // Free-taster exhausted — host opens the AiPaywallSheet/Dialog
      // on this 403. We DELIBERATELY do not also call the Pro 100/day
      // limiter so its bucket isn't touched by non-Pro traffic.
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
    // Pro path — the existing per-user 100/day bucket. Untouched by
    // the free-taster work (P0-6, 2026-04-25 — per-user scoping).
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

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "openai_not_configured", message: "Set OPENAI_API_KEY to enable photo logging." },
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

  // F-108 (2026-05-07): explicit AbortController with a sub-platform
  // timeout so a slow OpenAI response returns a structured error
  // instead of being killed by Vercel's `maxDuration`.
  const ac = new AbortController();
  const timeoutHandle = setTimeout(() => ac.abort(), OPENAI_TIMEOUT_MS);
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
        model: MODEL_VERSION,
        // 0.3 — deterministic enough; not so cold the ranges collapse
        // to point estimates. 0.0 made the model emit `low === high`
        // in early testing.
        temperature: 0.3,
        max_tokens: 2500,
        // JSON object mode forces the model to emit a single JSON
        // object — eliminates "I am happy to help, here is the JSON"
        // preamble that broke the previous parser.
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Identify every food item on this plate. Return the JSON described in the system message.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    const elapsedMs = Date.now() - startedAt;
    const isAbort =
      (err instanceof Error && err.name === "AbortError") ||
      (err as { name?: string } | null)?.name === "AbortError";
    if (isAbort) {
      console.warn(
        `[photo-log] openai timeout after ${elapsedMs}ms (limit ${OPENAI_TIMEOUT_MS}ms)`,
      );
      return NextResponse.json(
        {
          ok: false,
          error: "openai_timeout",
          message: "The AI took too long to respond. Try again in a moment.",
        },
        { status: 504 },
      );
    }
    console.error("[photo-log] openai fetch threw", err);
    return NextResponse.json(
      { ok: false, error: "openai_network_error", message: "Could not reach the AI service. Please try again." },
      { status: 502 },
    );
  }
  clearTimeout(timeoutHandle);

  if (!res.ok) {
    const bodyPreview = await res.text().catch(() => "");
    console.warn(
      `[photo-log] openai non-200 status=${res.status} bodyPreview=${bodyPreview.slice(0, 200)}`,
    );
    return NextResponse.json(
      {
        ok: false,
        error: "openai_http_error",
        status: res.status,
        message:
          res.status === 429
            ? "The AI service is busy right now. Try again in a moment."
            : "The AI service had a problem with this image. Try a different photo or angle.",
      },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

  let parsedJson: unknown;
  try {
    // JSON object mode means we expect raw JSON. Strip a stray code
    // fence just in case the model regressed (this happens
    // occasionally on older snapshots).
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
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

  const outcome = parsePhotoLogRangedResponse(parsedJson, MODEL_VERSION);
  if (outcome.kind === "unparseable") {
    // The model returned JSON we can't fit into the schema (missing
    // `items` array or top-level not an object). Distinct from the
    // upstream JSON.parse failure above — that one is a string-level
    // failure ("model returned 'sorry I can't help'"); this one is a
    // schema regression ("model returned the right top-level shape
    // but the wrong inside").
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
    // Model returned a valid shape but zero recognizable food items.
    // This is the only "no food detected" path — partial matches
    // ALWAYS succeed (see decision doc).
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
  // successful analyse. `null` for Pro (uncapped at the user-visible
  // level); a non-negative integer for Free + Base.
  return NextResponse.json({
    ...(outcome.response satisfies PhotoLogRangedResponse),
    freeQuotaRemaining,
  });
}
