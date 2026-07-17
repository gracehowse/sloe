import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { verifyIngredients } from "@/lib/nutrition/verifyIngredients";
import { recipeConfidenceTier } from "@/lib/nutrition/verifyConfidencePolicy";
import {
  buildPhotoRefinePrompt,
  buildVoiceRefinePrompt,
  clampRefineRound,
  normaliseRefinementText,
  parsePhotoRefineResponse,
  parseVoiceRefineResponse,
  REFINE_MAX_ROUNDS,
  type RefineVoiceItem,
} from "@/lib/nutrition/refineLog";
import {
  FREE_PHOTO_LOG_WEEKLY_LIMIT,
  FREE_PHOTO_LOG_WINDOW_MS,
} from "@/lib/nutrition/photoLogQuota";
import type {
  PhotoLogItemRanged,
  PhotoLogRangedResponse,
} from "@/lib/nutrition/photoLogRanges";
import type { VoiceLogItem } from "../voice-log/route";
import { AiBudgetExceededError, callAiText } from "@/lib/server/aiProvider";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { serverTrack } from "@/lib/analytics/serverTrack";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { assertOrigin } from "@/lib/api/assertOrigin";

export const runtime = "nodejs";

// Refine is a single text call (no vision) so it's fast, but keep headroom
// under Vercel's cap for the verify-pipeline hop on the voice path.
export const maxDuration = 60;

// Sub-platform timeout so we return a structured `ai_timeout` rather than
// being killed by Vercel.
const AI_TIMEOUT_MS = 30_000;

/**
 * ENG-974 — "refine by describing" re-estimation for photo + voice logs.
 *
 * After a photo or voice log produces an estimate, the user types a free-text
 * correction and the model re-estimates the WHOLE result from the current items
 * + the refinement. Conversational: each refine operates on the current result
 * (the client sends the latest items back), not the original.
 *
 * The model call happens SERVER-SIDE ONLY (prod pattern) via `callAiText`.
 *
 * Trust posture:
 *  - Photo path re-runs the model reply through the SAME strict validator as
 *    the first analyse (`parsePhotoRefineResponse` → `parsePhotoLogRangedResponse`),
 *    so a vague correction can only widen a range / drop to low confidence — it
 *    can never fabricate a tight number that the initial path would have rejected.
 *  - Voice path re-parses only the FOOD LIST from the model; nutrition comes from
 *    the verified pipeline (`verifyIngredients`), never from the LLM's macros.
 *
 * Gating mirrors the SOURCE route so a refine can't be a free bypass of the
 * source cap: voice = Pro-only; photo = free-taster bucket for non-Pro.
 *
 * See `docs/decisions/2026-07-01-log-refine-by-describing.md`.
 */

export type RefinePhotoResponse = PhotoLogRangedResponse & {
  round: number;
};

export type RefineVoiceResponse = {
  ok: true;
  source: "voice";
  items: VoiceLogItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  confidenceTier: "high" | "medium" | "low";
  round: number;
};

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  const routeStart = Date.now();

  // Reuse the source kill switches — if the underlying feature is dark, its
  // refine loop is dark too. Body is parsed after auth/gate to keep the fast
  // reject path cheap. Typed as a permissive record: every field is read
  // defensively (the union `RefineLogRequest` shape is the CLIENT contract,
  // but the route trusts nothing without a runtime guard).
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const source = body.source === "photo" || body.source === "voice" ? body.source : null;
  if (!source) {
    return NextResponse.json({ ok: false, error: "invalid_source" }, { status: 400 });
  }

  const killFlag = source === "photo" ? "kill_photo_log" : "kill_voice_log";
  if (await isServerFeatureEnabled(killFlag)) {
    return NextResponse.json(
      {
        ok: false,
        error: "service_unavailable",
        message: "Refining is temporarily unavailable. Try again shortly.",
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

  // ── Gating: mirror the source route ──
  if (source === "voice") {
    if (tier !== "pro") {
      return NextResponse.json(
        { ok: false, error: "upgrade_required", message: "Voice logging is a Pro feature." },
        { status: 403 },
      );
    }
    const limited = await rateLimit({
      keyPrefix: "api:refine-log:voice",
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
  } else {
    // Photo: non-Pro uses the free-taster bucket; Pro uses a 100/day bucket.
    // A refine costs a text call (cheaper than a vision analyse) but still
    // counts so the loop can't be a free bypass of the source cap.
    if (tier !== "pro") {
      const freeLimited = await rateLimit({
        keyPrefix: "api:refine-log:photo:free-quota",
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
              "You've used all your free AI logs this week. Pro unlocks AI logging up to 100 a day.",
            freeQuotaRemaining: 0,
          },
          { status: 403 },
        );
      }
    } else {
      const limited = await rateLimit({
        keyPrefix: "api:refine-log:photo",
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
  }

  // ── Validate the refinement text + round ──
  const refinementText = normaliseRefinementText(body.refinementText);
  if (!refinementText) {
    return NextResponse.json({ ok: false, error: "missing_refinement" }, { status: 400 });
  }
  const round = clampRefineRound(body.round);
  if (round >= REFINE_MAX_ROUNDS + 1) {
    // Client should hide the input past REFINE_MAX_ROUNDS; belt-and-braces.
    return NextResponse.json(
      { ok: false, error: "refine_limit_reached", message: "That's plenty of refining for one estimate — log it or start over." },
      { status: 429 },
    );
  }

  if (source === "photo") {
    return handlePhotoRefine({ body, refinementText, round, userId, tier, routeStart });
  }
  return handleVoiceRefine({ body, refinementText, round, userId, routeStart });
}

async function handlePhotoRefine(ctx: {
  body: Record<string, unknown>;
  refinementText: string;
  round: number;
  userId: string;
  tier: string;
  routeStart: number;
}) {
  const { body, refinementText, round, userId, tier, routeStart } = ctx;
  // Guard against a malformed body where items isn't an array at all.
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ ok: false, error: "invalid_items" }, { status: 400 });
  }
  const items = body.items as PhotoLogItemRanged[];

  const { system, user } = buildPhotoRefinePrompt({
    items,
    refinementText,
    notes: typeof body.notes === "string" ? body.notes : null,
  });

  const ac = new AbortController();
  const timeoutHandle = setTimeout(() => ac.abort(), AI_TIMEOUT_MS);
  let aiResult;
  try {
    aiResult = await callAiText({
      callSite: "refine-log-photo",
      userId,
      systemPrompt: system,
      userText: user,
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
          message: "AI is temporarily at capacity. Try again in a few hours or log manually.",
          retryAfterSec: err.retryAfterSec,
        },
        { status: 503, headers: { "Retry-After": String(err.retryAfterSec) } },
      );
    }
    captureRouteError(err, "/api/nutrition/refine-log", { stage: "photo-refine" });
    throw err;
  }
  clearTimeout(timeoutHandle);

  if (!aiResult.ok) {
    return NextResponse.json(
      { ok: false, error: aiResult.error, message: aiResult.message },
      { status: aiResult.status },
    );
  }

  let parsedJson: unknown;
  try {
    const cleaned = aiResult.text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    parsedJson = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "model_unparseable",
        message: "Couldn't read the AI's revised estimate. Try rephrasing your correction.",
      },
      { status: 502 },
    );
  }

  const outcome = parsePhotoRefineResponse(parsedJson, aiResult.modelVersion);
  if (outcome.kind === "unparseable") {
    return NextResponse.json(
      {
        ok: false,
        error: "model_unparseable",
        message: "Couldn't read the AI's revised estimate. Try rephrasing your correction.",
      },
      { status: 502 },
    );
  }
  if (outcome.kind === "no_items") {
    // A correction that emptied the plate (e.g. "remove everything"). Return a
    // dedicated code so the client can keep the prior result and message calmly.
    return NextResponse.json(
      {
        ok: false,
        error: "no_items_after_refine",
        message: "That correction left nothing on the plate. Add an item or start over.",
      },
      { status: 422 },
    );
  }

  const resp = outcome.response;
  const confidenceTier = resp.items.every((it) => it.confidence === "high")
    ? "high"
    : resp.items.some((it) => it.confidence === "low")
      ? "low"
      : "medium";

  void serverTrack(AnalyticsEvents.ai_log_refine_completed, userId, {
    source: "photo",
    round,
    itemCount: resp.items.length,
    confidenceTier,
    totalElapsedMs: Date.now() - routeStart,
    tier,
  });

  const out: RefinePhotoResponse = { ...resp, round };
  return NextResponse.json(out);
}

async function handleVoiceRefine(ctx: {
  body: Record<string, unknown>;
  refinementText: string;
  round: number;
  userId: string;
  routeStart: number;
}) {
  const { body, refinementText, round, userId, routeStart } = ctx;
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ ok: false, error: "invalid_items" }, { status: 400 });
  }
  const items = (body.items as RefineVoiceItem[]).filter(
    (it) => it && typeof it === "object" && typeof it.name === "string",
  );

  const { system, user } = buildVoiceRefinePrompt({
    items,
    refinementText,
    transcript: typeof body.transcript === "string" ? body.transcript : null,
  });

  const ac = new AbortController();
  const timeoutHandle = setTimeout(() => ac.abort(), AI_TIMEOUT_MS);
  let aiResult;
  try {
    aiResult = await callAiText({
      callSite: "refine-log-voice",
      userId,
      systemPrompt: system,
      userText: user,
      expectJson: true,
      temperature: 0.2,
      maxTokens: 500,
      claudeModel: "claude-haiku-4-5-20251001",
    });
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (err instanceof AiBudgetExceededError) {
      return NextResponse.json(
        {
          ok: false,
          error: "ai_capacity_reached",
          message: "AI is temporarily at capacity. Try again in a few hours or log manually.",
          retryAfterSec: err.retryAfterSec,
        },
        { status: 503, headers: { "Retry-After": String(err.retryAfterSec) } },
      );
    }
    captureRouteError(err, "/api/nutrition/refine-log", { stage: "voice-refine-parse" });
    throw err;
  }
  clearTimeout(timeoutHandle);

  if (!aiResult.ok) {
    return NextResponse.json(
      { ok: false, error: aiResult.error, message: aiResult.message },
      { status: aiResult.status },
    );
  }

  let parsedJson: unknown;
  try {
    const cleaned = aiResult.text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    parsedJson = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { ok: false, error: "model_unparseable", message: "The AI returned an unexpected format. Please try again." },
      { status: 502 },
    );
  }

  const foods = parseVoiceRefineResponse(parsedJson);
  if (foods.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_items_after_refine",
        message: "That correction left no foods to log. Add an item or start over.",
      },
      { status: 422 },
    );
  }

  // Nutrition ALWAYS comes from the verified pipeline — never the LLM's macros.
  try {
    const result = await verifyIngredients({
      ingredients: foods,
      servings: 1,
      provider: "auto",
      overrides: [],
    });

    const outItems: VoiceLogItem[] = result.verified.map((ing) => ({
      name: ing.matchedName ?? ing.resolved.name ?? "Unknown",
      quantity: `${ing.resolved.amount ?? ""} ${ing.resolved.unit ?? ""}`.trim() || "1 serving",
      calories: Math.round(ing.macros?.calories ?? 0),
      protein: Math.round(ing.macros?.protein ?? 0),
      carbs: Math.round(ing.macros?.carbs ?? 0),
      fat: Math.round(ing.macros?.fat ?? 0),
      confidence: ing.confidence,
      source: ing.source,
    }));

    const totalCalories = outItems.reduce((a, i) => a + i.calories, 0);
    const totalProtein = outItems.reduce((a, i) => a + i.protein, 0);
    const totalCarbs = outItems.reduce((a, i) => a + i.carbs, 0);
    const totalFat = outItems.reduce((a, i) => a + i.fat, 0);

    const confidenceTier = recipeConfidenceTier(result.avgIngredientConfidence);

    void serverTrack(AnalyticsEvents.ai_log_refine_completed, userId, {
      source: "voice",
      round,
      itemCount: outItems.length,
      confidenceTier,
      totalElapsedMs: Date.now() - routeStart,
    });

    const out: RefineVoiceResponse = {
      ok: true,
      source: "voice",
      items: outItems,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      confidenceTier,
      round,
    };
    return NextResponse.json(out);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "verify_failed",
        message: "Foods were parsed but nutrition lookup failed. Please try again.",
      },
      { status: 502 },
    );
  }
}
