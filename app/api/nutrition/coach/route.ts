import { NextResponse } from "next/server";
import {
  getUserIdFromRequest,
  getUserTier,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";
import { misconfiguredServiceRoleResponse } from "@/lib/server/serverEnv";
import { rateLimit } from "@/lib/server/rateLimit";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { AiBudgetExceededError, callAiText } from "@/lib/server/aiProvider";
import { serverTrack } from "@/lib/analytics/serverTrack";
import { AnalyticsEvents } from "@/lib/analytics/events";
import {
  applyCoachRanking,
  assembleCandidates,
  buildCoachUserMessage,
  COACH_SYSTEM_PROMPT,
  parseCoachRanking,
  type CoachCandidate,
  type CoachResult,
} from "@/lib/nutrition/mealCoach";
import type {
  NorthStarRecipe,
  NorthStarRemaining,
  NorthStarSlot,
} from "@/lib/nutrition/northStarSuggestion";
import { assertOrigin } from "@/lib/api/assertOrigin";

export const runtime = "nodejs";

/**
 * POST /api/nutrition/coach
 *
 * The "what to eat next" coach engine. Ranks the user's OWN saved
 * library against the macros they have left and returns a small set of
 * suggestions, each with a one-line WHY.
 *
 * Contract (mealCoach.ts): the deterministic scorer assembles + ranks
 * the candidates from verified data; the LLM only re-orders + phrases
 * over OUR candidates. Numbers are always ours. When the AI is
 * unavailable / over budget / returns garbage, we return the
 * deterministic candidate order — the surface never goes empty.
 *
 * Request body (the client owns the target/logged math, identical to
 * what the Today NorthStar host already computes):
 *   {
 *     remaining: { calories, protein, carbs, fat, dailyCalorieTarget },
 *     slot?: "breakfast" | "lunch" | "dinner" | "snack",
 *     excludeIds?: string[],            // skipped today
 *     recentlySuggestedIds?: string[],  // variety rotation
 *     limit?: number
 *   }
 *
 * Response: { ok: true, candidates: CoachCandidate[], source: "ai" | "deterministic" }
 */

type CoachRequestBody = {
  remaining?: Partial<NorthStarRemaining>;
  slot?: NorthStarSlot["slot"];
  excludeIds?: string[];
  recentlySuggestedIds?: string[];
  limit?: number;
};

function deterministicResponse(candidates: CoachCandidate[]) {
  const result: CoachResult = { candidates, source: "deterministic" };
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  const routeStart = Date.now();

  // Kill switch — lets us cut the AI ranking instantly without a deploy.
  // The deterministic path keeps working; we just skip the model.
  const killAi = await isServerFeatureEnabled("kill_meal_coach_ai").catch(
    () => false,
  );

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const serviceErr = misconfiguredServiceRoleResponse();
  if (serviceErr) return serviceErr;

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 503 },
    );
  }

  // ENG-1292 (docs/decisions/2026-07-01-sweep-decisions.md #1): the AI
  // re-rank is Pro-only, server-enforced — mirroring the voice-log
  // precedent (docs/decisions/2026-04-19-voice-logging-pro-only-server-enforced.md).
  // Unlike voice-log this is NOT a 403: free/Base users keep the full
  // deterministic coach (the screen stays a free-tier retention hook);
  // we just never spend on the model for them. Tier check runs in
  // parallel with the rate limit (voice-log's ENG-8 pattern).
  const [tier, limited] = await Promise.all([
    getUserTier(userId),
    rateLimit({
      keyPrefix: "api:coach",
      userId,
      limit: 120,
      windowMs: 60 * 60_000,
    }),
  ]);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  // ENG-1288 — server-side completion event (voice-log's
  // `voice_log_api_completed` pattern). Fires on every 200; never on
  // 4xx/5xx. `source: "template"` = deterministic path without an AI
  // attempt; `"error"` = AI attempted but failed → deterministic
  // fallback shipped. Fire-and-forget — analytics must not block.
  const emitCompleted = (source: "ai" | "template" | "error") => {
    void serverTrack(AnalyticsEvents.coach_api_completed, userId, {
      latency_ms: Date.now() - routeStart,
      source,
      tier,
    });
  };

  let body: CoachRequestBody;
  try {
    body = (await req.json()) as CoachRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const remaining = sanitizeRemaining(body.remaining);
  if (!remaining) {
    return NextResponse.json(
      { ok: false, error: "invalid_remaining" },
      { status: 400 },
    );
  }

  // Fetch the user's saved library. Service-role client is scoped to the
  // authenticated userId via the `saves` join so there is no cross-tenant
  // read. Mirror of the columns `apps/mobile/lib/recipes.ts` selects.
  const library = await fetchSavedLibrary(supabase, userId);

  const excludeIds = toIdSet(body.excludeIds);
  const recentlySuggestedIds = toIdSet(body.recentlySuggestedIds);
  const limit =
    Number.isFinite(body.limit) && (body.limit as number) > 0
      ? Math.min(8, Math.floor(body.limit as number))
      : undefined;

  // Deterministic candidate assembly — this is also the fallback answer.
  const candidates = assembleCandidates(library, remaining, {
    slot: body.slot,
    excludeIds,
    recentlySuggestedIds,
    limit,
  });

  // No recipe fits the remaining budget — return empty deterministically
  // (the surface renders its "no-fit" state). Never an error.
  if (candidates.length === 0) {
    emitCompleted("template");
    return deterministicResponse([]);
  }

  // Skip the AI call when: the kill switch is on, the caller is not Pro
  // (ENG-1292 — AI re-rank is a Pro entitlement), or a single candidate
  // has nothing to re-rank. Same payload shape, source: "deterministic".
  if (killAi || tier !== "pro" || candidates.length < 2) {
    emitCompleted("template");
    return deterministicResponse(candidates);
  }

  // Hand the PRE-SCORED candidates to the model to re-rank + phrase.
  const userMessage = buildCoachUserMessage(candidates, remaining, body.slot);
  let aiResult;
  try {
    aiResult = await callAiText({
      callSite: "meal-coach",
      userId,
      systemPrompt: COACH_SYSTEM_PROMPT,
      userText: userMessage,
      expectJson: true,
      temperature: 0.4,
      maxTokens: 400,
      // Cheap, fast selection/phrasing task — Haiku is plenty.
      claudeModel: "claude-haiku-4-5-20251001",
    });
  } catch (err) {
    if (err instanceof AiBudgetExceededError) {
      // Budget exhausted — fall back to the deterministic order. The
      // surface still works; we just don't spend on AI phrasing.
      emitCompleted("error");
      return deterministicResponse(candidates);
    }
    captureRouteError(err, "/api/nutrition/coach", { stage: "rank" });
    emitCompleted("error");
    return deterministicResponse(candidates);
  }

  if (!aiResult.ok) {
    // Any provider error (timeout, http, not-configured) → deterministic.
    emitCompleted("error");
    return deterministicResponse(candidates);
  }

  const ranking = parseCoachRanking(
    aiResult.text,
    candidates.map((c) => c.recipeId),
  );
  const ranked = applyCoachRanking(candidates, ranking);
  const result: CoachResult = {
    candidates: ranked,
    source: ranking ? "ai" : "deterministic",
  };
  // A null ranking means the model answered but off-contract — that is an
  // AI attempt that failed, not a deliberate template path.
  emitCompleted(ranking ? "ai" : "error");
  return NextResponse.json({ ok: true, ...result });
}

/* ------------------------------ helpers ------------------------------ */

function sanitizeRemaining(
  raw: Partial<NorthStarRemaining> | undefined,
): NorthStarRemaining | null {
  if (!raw || typeof raw !== "object") return null;
  const calories = Number(raw.calories);
  const protein = Number(raw.protein);
  const carbs = Number(raw.carbs);
  const fat = Number(raw.fat);
  const dailyCalorieTarget = Number(raw.dailyCalorieTarget);
  if (
    !Number.isFinite(calories) ||
    !Number.isFinite(protein) ||
    !Number.isFinite(carbs) ||
    !Number.isFinite(fat)
  ) {
    return null;
  }
  return {
    calories,
    protein,
    carbs,
    fat,
    // Non-finite target degrades gracefully inside the scorer (falls back
    // to remaining as the meal budget) — keep it numeric here.
    dailyCalorieTarget: Number.isFinite(dailyCalorieTarget)
      ? dailyCalorieTarget
      : 0,
  };
}

function toIdSet(raw: unknown): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((s): s is string => typeof s === "string"));
}

type RecipeRow = {
  id: string;
  title: string | null;
  image_url: string | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  meal_type: string | string[] | null;
  cook_time_min: number | null;
};

async function fetchSavedLibrary(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  userId: string,
): Promise<NorthStarRecipe[]> {
  if (!supabase) return [];
  // Saved recipe ids for this user (the `saves` join table).
  const { data: saveRows, error: saveErr } = await supabase
    .from("saves")
    .select("recipe_id")
    .eq("user_id", userId);
  if (saveErr || !saveRows || saveRows.length === 0) return [];
  const ids = saveRows
    .map((r) => (r as { recipe_id?: string }).recipe_id)
    .filter((s): s is string => typeof s === "string");
  if (ids.length === 0) return [];

  const { data: recipes, error: recErr } = await supabase
    .from("recipes")
    .select("id, title, image_url, calories, protein, carbs, fat, meal_type, cook_time_min")
    .in("id", ids);
  if (recErr || !recipes) return [];

  return (recipes as RecipeRow[]).map((r) => ({
    id: r.id,
    title: r.title ?? "Saved recipe",
    calories: Number(r.calories) || 0,
    protein: Number(r.protein) || 0,
    carbs: Number(r.carbs) || 0,
    fat: Number(r.fat) || 0,
    thumbnail: r.image_url ?? undefined,
    mealType: r.meal_type ?? null,
    cookTimeMin: r.cook_time_min != null ? Number(r.cook_time_min) : null,
  }));
}
